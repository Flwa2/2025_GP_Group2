from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
import smtplib
import traceback

from email_templates import generate_wecast_email_template
from services.email_config import (
    env_value,
    frontend_public_url,
    logo_url,
    sender_email,
    sender_name,
    support_email,
    validate_email_configuration,
)


@dataclass(frozen=True)
class EmailContent:
    subject: str
    html_body: str
    text_body: str


def _default_url(path):
    try:
        base = frontend_public_url()
    except Exception:
        base = "https://wecast-frontend.onrender.com"
    return f"{base}{path}"


def validate_email_environment():
    """Return non-secret email configuration status for diagnostics."""
    return validate_email_configuration()


def _render_template(
    *,
    title,
    message,
    button_text,
    button_url,
    eyebrow="WeCast Account",
    notice_text=None,
    detail_label="",
    detail_lines=None,
):
    try:
        resolved_logo_url = logo_url()
    except Exception:
        resolved_logo_url = "https://wecast-frontend.onrender.com/logo.png"

    return generate_wecast_email_template(
        title=title,
        message=message,
        button_text=button_text,
        button_url=button_url,
        logo_url=resolved_logo_url,
        support_email=support_email(),
        eyebrow=eyebrow,
        notice_text=notice_text
        or "This secure link helps protect your WeCast account. If you did not request this email, you can safely ignore it.",
        detail_label=detail_label,
        detail_lines=detail_lines,
    )


def _text_body(*lines, button_url=""):
    parts = [str(line).strip() for line in lines if str(line or "").strip()]
    if button_url:
        parts.extend(["", "Open secure link:", button_url])
    if support_email():
        parts.extend(["", f"Need help? Contact {support_email()}."])
    return "\n".join(parts).strip()


def _smtp_port():
    try:
        return int(env_value("SMTP_PORT"))
    except ValueError as exc:
        raise ValueError("SMTP_PORT must be a number.") from exc


def _safe_exception_payload(step, exc):
    frame = traceback.extract_tb(exc.__traceback__)[-1] if exc.__traceback__ else None
    return {
        "ok": False,
        "step": step,
        "errorType": type(exc).__name__,
        "message": str(exc)[:180],
        "function": frame.name if frame else "",
        "line": frame.lineno if frame else None,
    }


def _send_email(to_email, content, *, dry_run=False):
    to_email = (to_email or "").strip().lower()
    config = validate_email_environment()

    if dry_run:
        return {
            "ok": True,
            "dryRun": True,
            "to": to_email,
            "subject": content.subject,
            "htmlLength": len(content.html_body),
            "textLength": len(content.text_body),
            "env": config,
        }

    if not config["ready"]:
        return {
            "ok": False,
            "step": "env",
            "errorType": "MissingEnvironment",
            "error": "Email environment is not configured.",
            "missing": config["missing"],
        }

    try:
        from_name = sender_name()
        from_email = sender_email()
        message = MIMEMultipart("alternative")
        message["Subject"] = content.subject
        message["From"] = formataddr((from_name, from_email))
        message["To"] = to_email
        message["Reply-To"] = support_email() or from_email
        message.attach(MIMEText(content.text_body, "plain", "utf-8"))
        message.attach(MIMEText(content.html_body, "html", "utf-8"))
    except Exception as exc:
        payload = _safe_exception_payload("html_assembly", exc)
        payload["error"] = "Email assembly failed."
        return payload

    try:
        host = env_value("SMTP_HOST")
        port = _smtp_port()
        username = env_value("SMTP_USER")
        password = env_value("SMTP_PASS")

        if port == 465:
            try:
                smtp = smtplib.SMTP_SSL(host, port, timeout=30)
            except Exception as exc:
                payload = _safe_exception_payload("smtp_connection", exc)
                payload["error"] = "SMTP connection failed."
                return payload
            with smtp:
                try:
                    smtp.login(username, password)
                except Exception as exc:
                    payload = _safe_exception_payload("smtp_auth", exc)
                    payload["error"] = "SMTP authentication failed."
                    return payload
                try:
                    smtp.send_message(message)
                except Exception as exc:
                    payload = _safe_exception_payload("smtp_send", exc)
                    payload["error"] = "SMTP send failed."
                    return payload
        else:
            try:
                smtp = smtplib.SMTP(host, port, timeout=30)
            except Exception as exc:
                payload = _safe_exception_payload("smtp_connection", exc)
                payload["error"] = "SMTP connection failed."
                return payload
            with smtp:
                smtp.ehlo()
                try:
                    smtp.starttls()
                except Exception as exc:
                    payload = _safe_exception_payload("smtp_tls", exc)
                    payload["error"] = "SMTP TLS negotiation failed."
                    return payload
                smtp.ehlo()
                try:
                    smtp.login(username, password)
                except Exception as exc:
                    payload = _safe_exception_payload("smtp_auth", exc)
                    payload["error"] = "SMTP authentication failed."
                    return payload
                try:
                    smtp.send_message(message)
                except Exception as exc:
                    payload = _safe_exception_payload("smtp_send", exc)
                    payload["error"] = "SMTP send failed."
                    return payload
    except ValueError as exc:
        return {
            "ok": False,
            "step": "env",
            "errorType": type(exc).__name__,
            "error": "SMTP environment is invalid.",
            "missing": ["SMTP_PORT"],
        }
    except Exception as exc:
        return {
            "ok": False,
            "step": "smtp",
            "errorType": type(exc).__name__,
            "error": "SMTP send failed.",
        }

    return {
        "ok": True,
        "provider": "smtp",
        "to": to_email,
        "subject": content.subject,
    }


def _verification_content(action_url):
    url = action_url or _default_url("/#/verify-email?preview=1")
    message = (
        "Welcome to WeCast. Confirm your email address so we can keep your "
        "account secure and help you access your podcast workspace."
    )
    return EmailContent(
        subject="Verify your WeCast email",
        html_body=_render_template(
            title="Verify your email",
            message=message,
            button_text="Verify Email",
            button_url=url,
        ),
        text_body=_text_body(message, button_url=url),
    )


def send_verification_email(email, action_url=None, *, dry_run=False):
    if not action_url and not dry_run and validate_email_environment().get("ready"):
        from services.firebase_action_links import generate_email_verification_link

        action_url = generate_email_verification_link(email)
    return _send_email(email, _verification_content(action_url), dry_run=dry_run)


def _password_reset_content(action_url):
    url = action_url or _default_url("/#/reset-password?preview=1")
    lines = [
        "We received a request to reset the password for your WeCast account.",
        "Use the button below to choose a new password. If you did not request this, you can safely ignore this email.",
    ]
    return EmailContent(
        subject="Reset your WeCast password",
        html_body=_render_template(
            title="Reset your password",
            message=lines,
            button_text="Reset Password",
            button_url=url,
            notice_text="For your security, this reset link should only be used by you. If you did not request it, no action is needed.",
        ),
        text_body=_text_body(*lines, button_url=url),
    )


def send_password_reset_email(email, action_url=None, *, dry_run=False):
    if not action_url and not dry_run and validate_email_environment().get("ready"):
        from services.firebase_action_links import generate_password_reset_link

        action_url = generate_password_reset_link(email)
    return _send_email(
        email,
        _password_reset_content(action_url),
        dry_run=dry_run,
    )


def _password_changed_content(action_url):
    url = action_url or _default_url("/#/account?section=security")
    lines = [
        "This confirms that the password for your WeCast account was changed successfully.",
        "If this was you, no further action is needed. If this was not you, contact support immediately so we can help protect your account.",
    ]
    return EmailContent(
        subject="Your WeCast password was changed",
        html_body=_render_template(
            title="Your password was changed",
            message=lines,
            button_text="Review Account Security",
            button_url=url,
            eyebrow="Security confirmation",
            notice_text="Keep your account secure by using a unique password and signing out of shared devices.",
        ),
        text_body=_text_body(*lines, button_url=url),
    )


def send_password_changed_email(email, action_url=None, *, dry_run=False):
    return _send_email(email, _password_changed_content(action_url), dry_run=dry_run)


def _confirm_new_email_content(action_url, current_email):
    url = action_url or _default_url("/#/email-change-confirm?preview=1")
    lines = [
        "A request was made to change the email address on your WeCast account.",
        "Your current login email will remain active until this new email address is verified.",
        "If you did not request this change, you can ignore this email.",
    ]
    return EmailContent(
        subject="Confirm your new WeCast email",
        html_body=_render_template(
            title="Confirm your new email",
            message=lines,
            button_text="Confirm New Email",
            button_url=url,
            eyebrow="Email change",
            detail_label="Current account email",
            detail_lines=[current_email] if current_email else None,
            notice_text="The account email will not change unless this new email address is confirmed.",
        ),
        text_body=_text_body(*lines, button_url=url),
    )


def send_confirm_new_email(new_email, current_email="", action_url=None, *, dry_run=False):
    content = _confirm_new_email_content(action_url, current_email)
    return _send_email(new_email, content, dry_run=dry_run)


def _email_change_requested_content(action_url, new_email):
    url = action_url or _default_url("/#/account?section=security")
    lines = [
        "A request was made to change the email address on your WeCast account.",
        "No change will happen unless the new email address is verified.",
        "If this was not you, secure your account immediately.",
    ]
    return EmailContent(
        subject="A request was made to change your WeCast email",
        html_body=_render_template(
            title="A request was made to change your email",
            message=lines,
            button_text="Secure My Account",
            button_url=url,
            eyebrow="Security notice",
            detail_label="Requested new email",
            detail_lines=[new_email] if new_email else None,
            notice_text="Your current email remains active while this request is pending.",
        ),
        text_body=_text_body(*lines, button_url=url),
    )


def send_email_change_requested(old_email, new_email="", action_url=None, *, dry_run=False):
    content = _email_change_requested_content(action_url, new_email)
    return _send_email(old_email, content, dry_run=dry_run)


def _email_changed_success_content(action_url, old_email, new_email):
    url = action_url or ""
    lines = [
        "This confirms that the email address on your WeCast account was changed successfully.",
        "If this was not you, contact support immediately so we can help protect your account.",
    ]
    return EmailContent(
        subject="Your WeCast account email was changed",
        html_body=_render_template(
            title="Your account email was changed",
            message=lines,
            button_text="Contact Support" if url else "",
            button_url=url,
            eyebrow="Security confirmation",
            detail_label="Email change",
            detail_lines=[
                f"Previous email: {old_email}",
                f"New email: {new_email}",
            ],
            notice_text="You may need to sign in again using the new email address.",
        ),
        text_body=_text_body(*lines, button_url=url),
    )


def send_email_changed_success(old_email, new_email="", action_url=None, *, dry_run=False):
    content = _email_changed_success_content(action_url, old_email, new_email)
    return _send_email(old_email, content, dry_run=dry_run)
