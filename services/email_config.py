import os
from urllib.parse import urlparse

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


if load_dotenv:
    load_dotenv(override=False)


SMTP_ENV_KEYS = (
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "FROM_EMAIL",
    "FROM_NAME",
)
RESEND_ENV_KEYS = (
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
)
SUPPORTED_ENV_KEYS = (
    *SMTP_ENV_KEYS,
    *RESEND_ENV_KEYS,
    "RESEND_FROM_NAME",
    "BACKEND_PUBLIC_URL",
    "FRONTEND_PUBLIC_URL",
    "WECAST_APP_URL",
    "WECAST_ENV",
    "WECAST_SUPPORT_EMAIL",
    "WECAST_LOGO_URL",
    "WECAST_SMTP_TIMEOUT_SECONDS",
    "WECAST_SMTP_TOTAL_TIMEOUT_SECONDS",
)
FRONTEND_URL_KEYS = ("FRONTEND_PUBLIC_URL", "WECAST_APP_URL", "FRONTEND_URL")


class EmailConfigError(RuntimeError):
    pass


def env_value(name):
    return (os.getenv(name) or "").strip()


def _truthy_env(name):
    return env_value(name).lower() in {"1", "true", "yes", "on"}


def is_production():
    if env_value("FLASK_ENV").lower() in {"prod", "production"}:
        return True
    if _truthy_env("RENDER"):
        return True
    if env_value("WECAST_ENV").lower() in {"prod", "production"}:
        return True
    return False


def _is_local_frontend_url(value):
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    return host in {"localhost", "127.0.0.1"}


def _validate_absolute_url(name, value):
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise EmailConfigError(f"{name} must be an absolute URL.")
    if is_production() and (
        parsed.scheme != "https"
        or "localhost" in parsed.netloc.lower()
        or "127.0.0.1" in parsed.netloc
    ):
        raise EmailConfigError(f"{name} must be a public HTTPS URL in production.")
    return value.rstrip("/")


def _frontend_url_keys_in_priority_order():
    keys = list(FRONTEND_URL_KEYS)
    if is_production():
        return keys

    local_keys = [
        key
        for key in keys
        if env_value(key) and _is_local_frontend_url(env_value(key))
    ]
    return local_keys + [key for key in keys if key not in local_keys]


def _must_skip_localhost_urls():
    """On Render / production, never use localhost from .env for public links."""
    return is_production() or _truthy_env("RENDER")


def frontend_public_url():
    for key in _frontend_url_keys_in_priority_order():
        value = env_value(key)
        if not value:
            continue
        if _must_skip_localhost_urls() and _is_local_frontend_url(value):
            continue
        return _validate_absolute_url(key, value)
    raise EmailConfigError("Missing required environment variable: FRONTEND_PUBLIC_URL")


def frontend_public_url_candidates():
    candidates = []
    seen = set()
    for key in _frontend_url_keys_in_priority_order():
        value = env_value(key)
        if not value:
            continue
        if _must_skip_localhost_urls() and _is_local_frontend_url(value):
            continue
        normalized = _validate_absolute_url(key, value)
        if normalized in seen:
            continue
        seen.add(normalized)
        candidates.append(normalized)
    if not candidates:
        raise EmailConfigError("Missing required environment variable: FRONTEND_PUBLIC_URL")
    return candidates


def sender_email():
    return env_value("FROM_EMAIL") or env_value("RESEND_FROM_EMAIL")


def sender_name():
    return env_value("FROM_NAME") or env_value("RESEND_FROM_NAME") or "WeCast"


def support_email():
    return env_value("WECAST_SUPPORT_EMAIL") or sender_email()


def logo_url():
    return env_value("WECAST_LOGO_URL") or f"{frontend_public_url()}/logo.png"


def _smtp_port_error():
    raw_port = env_value("SMTP_PORT")
    if not raw_port:
        return ""
    try:
        port = int(raw_port)
    except ValueError:
        return "SMTP_PORT must be a number."
    if port < 1 or port > 65535:
        return "SMTP_PORT must be between 1 and 65535."
    return ""


def _gmail_smtp_config_errors():
    host = env_value("SMTP_HOST").lower()
    if host not in {"smtp.gmail.com", "gmail-smtp-in.l.google.com"}:
        return []

    errors = []
    smtp_user = env_value("SMTP_USER").lower()
    from_email = env_value("FROM_EMAIL").lower()
    if smtp_user and from_email and smtp_user != from_email:
        errors.append(
            {
                "key": "FROM_EMAIL",
                "error": "For Gmail SMTP, FROM_EMAIL must match SMTP_USER.",
            }
        )

    app_password = env_value("SMTP_PASS").replace(" ", "")
    if app_password and len(app_password) != 16:
        errors.append(
            {
                "key": "SMTP_PASS",
                "error": "For Gmail SMTP, use a 16-character Gmail App Password, not the normal Gmail password.",
            }
        )

    return errors


def validate_email_configuration():
    smtp_missing = [key for key in SMTP_ENV_KEYS if not env_value(key)]
    resend_missing = [key for key in RESEND_ENV_KEYS if not env_value(key)]
    smtp_port_error = _smtp_port_error()
    smtp_ready = not smtp_missing and not smtp_port_error
    smtp_present = any(env_value(key) for key in SMTP_ENV_KEYS)
    resend_ready = not resend_missing
    if smtp_ready:
        provider = "smtp"
    elif smtp_present:
        provider = ""
    elif resend_ready:
        provider = "resend"
    else:
        provider = ""

    missing = []
    invalid = []
    if not provider:
        missing = sorted(set(smtp_missing if smtp_present else resend_missing + smtp_missing))
    if smtp_present and smtp_port_error:
        invalid.append({"key": "SMTP_PORT", "error": smtp_port_error})
    if smtp_present:
        invalid.extend(_gmail_smtp_config_errors())
        if invalid:
            provider = ""
            smtp_ready = False

    url_ready = True
    try:
        frontend_public_url()
    except EmailConfigError:
        url_ready = False
        missing.append("FRONTEND_PUBLIC_URL")

    present = [key for key in SUPPORTED_ENV_KEYS if env_value(key)]
    optional_missing = [
        key
        for key in SUPPORTED_ENV_KEYS
        if key not in present and key not in {"WECAST_LOGO_URL"}
    ]
    return {
        "ready": bool(provider) and url_ready,
        "missing": missing,
        "invalid": invalid,
        "present": present,
        "optionalMissing": optional_missing,
        "smtpPresent": smtp_ready,
        "resendPresent": resend_ready,
        "provider": provider,
    }
