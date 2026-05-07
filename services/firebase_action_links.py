from urllib.parse import parse_qsl, urlencode, urlparse

from services.email_config import (
    EmailConfigError,
    frontend_public_url,
    frontend_public_url_candidates,
)


class FirebaseActionLinkError(RuntimeError):
    pass


def public_app_url():
    try:
        return frontend_public_url()
    except EmailConfigError as exc:
        raise FirebaseActionLinkError(str(exc)) from exc


def _action_code_settings(path, base_url=None):
    from firebase_admin import auth as fb_auth

    route = path if path.startswith("/") else f"/{path}"
    return fb_auth.ActionCodeSettings(
        url=f"{(base_url or public_app_url()).rstrip('/')}{route}",
        handle_code_in_app=True,
    )


def _is_unauthorized_domain_error(exc):
    return "UNAUTHORIZED_DOMAIN" in str(exc).upper()


def _generate_link_with_domain_fallback(email, path, generator):
    candidates = frontend_public_url_candidates()
    last_error = None
    for index, base_url in enumerate(candidates):
        try:
            return generator(email, _action_code_settings(path, base_url))
        except Exception as exc:
            last_error = exc
            if index < len(candidates) - 1 and _is_unauthorized_domain_error(exc):
                continue
            raise
    if last_error:
        raise last_error
    raise FirebaseActionLinkError("No valid app URL was available.")


def _firebase_auth():
    import firebase_init  # noqa: F401
    from firebase_admin import auth as fb_auth

    return fb_auth


def _build_custom_reset_link(firebase_link):
    parsed = urlparse(firebase_link or "")
    params = dict(parse_qsl(parsed.query, keep_blank_values=True))
    required = ("mode", "oobCode", "apiKey")
    if not all(params.get(key) for key in required):
        raise FirebaseActionLinkError("Firebase reset link is missing required parameters.")

    keep_params = {
        key: value
        for key, value in params.items()
        if key in {"mode", "oobCode", "apiKey", "continueUrl", "lang", "tenantId"}
        and value not in (None, "")
    }
    query = urlencode(keep_params)
    return f"{public_app_url().rstrip('/')}/#/reset-password?{query}"


def generate_email_verification_link(email):
    normalized_email = (email or "").strip().lower()
    if not normalized_email:
        raise FirebaseActionLinkError("Email is required.")

    fb_auth = _firebase_auth()
    return _generate_link_with_domain_fallback(
        normalized_email,
        "/#/verify-email",
        fb_auth.generate_email_verification_link,
    )


def generate_password_reset_link(email):
    normalized_email = (email or "").strip().lower()
    if not normalized_email:
        raise FirebaseActionLinkError("Email is required.")

    fb_auth = _firebase_auth()
    firebase_link = _generate_link_with_domain_fallback(
        normalized_email,
        "/reset-password",
        fb_auth.generate_password_reset_link,
    )
    return _build_custom_reset_link(firebase_link)
