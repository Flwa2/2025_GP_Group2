import os
from urllib.parse import urlparse

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


if load_dotenv:
    load_dotenv()


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
    "WECAST_SUPPORT_EMAIL",
    "WECAST_LOGO_URL",
)
FRONTEND_URL_KEYS = ("FRONTEND_PUBLIC_URL", "WECAST_APP_URL", "FRONTEND_URL")


class EmailConfigError(RuntimeError):
    pass


def env_value(name):
    return (os.getenv(name) or "").strip()


def is_production():
    return env_value("FLASK_ENV").lower() in {"prod", "production"} or bool(
        env_value("RENDER")
    )


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


def frontend_public_url():
    for key in _frontend_url_keys_in_priority_order():
        value = env_value(key)
        if value:
            return _validate_absolute_url(key, value)
    raise EmailConfigError("Missing required environment variable: FRONTEND_PUBLIC_URL")


def frontend_public_url_candidates():
    candidates = []
    seen = set()
    for key in _frontend_url_keys_in_priority_order():
        value = env_value(key)
        if not value:
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


def validate_email_configuration():
    smtp_missing = [key for key in SMTP_ENV_KEYS if not env_value(key)]
    resend_missing = [key for key in RESEND_ENV_KEYS if not env_value(key)]
    smtp_ready = not smtp_missing
    resend_ready = not resend_missing
    provider = "resend" if resend_ready else "smtp" if smtp_ready else ""
    missing = [] if provider else sorted(set(resend_missing + smtp_missing))

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
        "present": present,
        "optionalMissing": optional_missing,
        "smtpPresent": smtp_ready,
        "resendPresent": resend_ready,
        "provider": provider,
    }
