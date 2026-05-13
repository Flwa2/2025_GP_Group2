from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
import requests
import socket
import smtplib
import time
import traceback

from email_templates import generate_wecast_email_template
from services.email_config import (
    env_value,
    frontend_public_url,
    logo_url,
    sender_email,
    sender_name,
    support_email,
    is_production,
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


def _public_login_url():
    """Public app URL for sign-in only (no tokens)."""
    try:
        base = str(frontend_public_url() or "").strip().rstrip("/")
    except Exception:
        base = ""
    if not base:
        base = "https://wecast-frontend.onrender.com"
    return f"{base}/#/login"


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
    secondary_button_text="",
    secondary_button_url="",
):
    try:
        resolved_logo_url = logo_url()
    except Exception:
        resolved_logo_url = "https://wecast-frontend.onrender.com/logo.png"

    resolved_notice_text = (
        "This secure link helps protect your WeCast account. If you did not request this email, you can safely ignore it."
        if notice_text is None
        else notice_text
    )

    return generate_wecast_email_template(
        title=title,
        message=message,
        button_text=button_text,
        button_url=button_url,
        logo_url=resolved_logo_url,
        support_email=support_email(),
        eyebrow=eyebrow,
        notice_text=resolved_notice_text,
        detail_label=detail_label,
        detail_lines=detail_lines,
        secondary_button_text=secondary_button_text,
        secondary_button_url=secondary_button_url,
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
        port = int(env_value("SMTP_PORT"))
    except ValueError as exc:
        raise ValueError("SMTP_PORT must be a number.") from exc
    if port < 1 or port > 65535:
        raise ValueError("SMTP_PORT must be between 1 and 65535.")
    return port


def _smtp_timeout_seconds():
    try:
        timeout = float(env_value("WECAST_SMTP_TIMEOUT_SECONDS") or "5")
    except ValueError:
        timeout = 5.0
    return min(max(timeout, 2.0), 10.0)


def _smtp_total_timeout_seconds():
    try:
        timeout = float(env_value("WECAST_SMTP_TOTAL_TIMEOUT_SECONDS") or "20")
    except ValueError:
        timeout = 20.0
    return min(max(timeout, 8.0), 25.0)


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


def _smtp_fallback_disabled():
    return env_value("WECAST_DISABLE_SMTP_FALLBACK").lower() in {"1", "true", "yes"}


def _smtp_failure_payload(step, exc, error):
    payload = _safe_exception_payload(step, exc)
    payload["error"] = error
    return payload


def _smtp_safe_error(exc):
    return {
        "errorType": type(exc).__name__,
        "message": str(exc)[:180],
        "errno": getattr(exc, "errno", None),
    }


def _log_smtp_attempt(host, port, username, from_email):
    print(
        "SMTP email delivery:",
        "provider=smtp",
        f"SMTP_HOST={host or '<missing>'}",
        f"SMTP_PORT={port or '<missing>'}",
        f"SMTP_USER={bool(username)}",
        f"FROM_EMAIL={bool(from_email)}",
        flush=True,
    )


def _log_smtp_timing(step, started_at, ok, error_type=""):
    elapsed_ms = int((time.monotonic() - started_at) * 1000)
    print(
        "SMTP timing:",
        f"step={step}",
        f"elapsed_ms={elapsed_ms}",
        f"ok={bool(ok)}",
        f"errorType={error_type or '<none>'}",
        flush=True,
    )


def _smtp_operation_timeout(deadline):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError("SMTP total timeout exceeded.")
    return min(_smtp_timeout_seconds(), remaining)


def _set_smtp_socket_timeout(smtp, timeout):
    sock = getattr(smtp, "sock", None)
    if sock is not None:
        sock.settimeout(timeout)


def _run_smtp_step(step, func, *, smtp=None, deadline):
    started_at = time.monotonic()
    try:
        timeout = _smtp_operation_timeout(deadline)
        if smtp is not None:
            _set_smtp_socket_timeout(smtp, timeout)
        value = func(timeout)
        if smtp is not None:
            _set_smtp_socket_timeout(smtp, _smtp_operation_timeout(deadline))
        _log_smtp_timing(step, started_at, True)
        return value, None
    except (socket.timeout, TimeoutError) as exc:
        _log_smtp_timing(step, started_at, False, type(exc).__name__)
        return None, _smtp_failure_payload(step, exc, f"SMTP {step.replace('smtp_', '')} timed out.")
    except (OSError, smtplib.SMTPException, SystemExit) as exc:
        _log_smtp_timing(step, started_at, False, type(exc).__name__)
        return None, _smtp_failure_payload(step, exc, f"SMTP {step.replace('smtp_', '')} failed.")
    except Exception as exc:
        _log_smtp_timing(step, started_at, False, type(exc).__name__)
        return None, _smtp_failure_payload(step, exc, f"SMTP {step.replace('smtp_', '')} failed.")


def _send_prepared_message_via_smtp(message, to_email, content):
    try:
        host = env_value("SMTP_HOST")
        port = _smtp_port()
        username = env_value("SMTP_USER")
        password = env_value("SMTP_PASS")
        from_email = env_value("FROM_EMAIL")
        _log_smtp_attempt(host, port, username, from_email)
        deadline = time.monotonic() + _smtp_total_timeout_seconds()

        if port == 465:
            smtp, error = _run_smtp_step(
                "smtp_connect",
                lambda timeout: smtplib.SMTP_SSL(host, port, timeout=timeout),
                deadline=deadline,
            )
            if error:
                return error
            with smtp:
                _, error = _run_smtp_step(
                    "smtp_login",
                    lambda timeout: smtp.login(username, password),
                    smtp=smtp,
                    deadline=deadline,
                )
                if error:
                    return error
                _, error = _run_smtp_step(
                    "smtp_send",
                    lambda timeout: smtp.send_message(message),
                    smtp=smtp,
                    deadline=deadline,
                )
                if error:
                    return error
        else:
            smtp, error = _run_smtp_step(
                "smtp_connect",
                lambda timeout: smtplib.SMTP(host, port, timeout=timeout),
                deadline=deadline,
            )
            if error:
                return error
            with smtp:
                _, error = _run_smtp_step(
                    "smtp_ehlo",
                    lambda timeout: smtp.ehlo(),
                    smtp=smtp,
                    deadline=deadline,
                )
                if error:
                    return error
                _, error = _run_smtp_step(
                    "smtp_tls",
                    lambda timeout: smtp.starttls(),
                    smtp=smtp,
                    deadline=deadline,
                )
                if error:
                    return error
                _, error = _run_smtp_step(
                    "smtp_ehlo",
                    lambda timeout: smtp.ehlo(),
                    smtp=smtp,
                    deadline=deadline,
                )
                if error:
                    return error
                _, error = _run_smtp_step(
                    "smtp_login",
                    lambda timeout: smtp.login(username, password),
                    smtp=smtp,
                    deadline=deadline,
                )
                if error:
                    return error
                _, error = _run_smtp_step(
                    "smtp_send",
                    lambda timeout: smtp.send_message(message),
                    smtp=smtp,
                    deadline=deadline,
                )
                if error:
                    return error
    except ValueError as exc:
        return {
            "ok": False,
            "step": "env",
            "errorType": type(exc).__name__,
            "error": "SMTP environment is invalid.",
            "missing": ["SMTP_PORT"],
        }
    except SystemExit as exc:
        return _smtp_failure_payload("smtp", exc, "SMTP send failed.")
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
            "invalid": config.get("invalid") or [],
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

    if config.get("provider") == "resend":
        resend_result = _send_email_via_resend(to_email, content)
        if resend_result.get("ok"):
            return resend_result
        if is_production():
            return resend_result
        if (
            config.get("smtpPresent")
            and not _smtp_fallback_disabled()
        ):
            print(
                "Email delivery: Resend failed; attempting SMTP fallback.",
                f"resendStep={resend_result.get('step')}",
                f"httpStatus={resend_result.get('status')}",
                f"message={(resend_result.get('message') or resend_result.get('error') or '')[:200]}",
                flush=True,
            )
            smtp_result = _send_prepared_message_via_smtp(message, to_email, content)
            if smtp_result.get("ok"):
                smtp_result = dict(smtp_result)
                smtp_result["deliveryPath"] = "smtp_fallback_after_resend"
                return smtp_result
            smtp_result = dict(smtp_result)
            smtp_result["resendStatus"] = resend_result.get("status")
            smtp_result["resendMessage"] = (
                resend_result.get("message") or resend_result.get("error") or ""
            )[:300]
            return smtp_result
        return resend_result

    return _send_prepared_message_via_smtp(message, to_email, content)


def check_smtp_connectivity(*, timeout_seconds=None):
    """Probe SMTP reachability without authenticating or sending email."""
    host = env_value("SMTP_HOST")
    configured_port = env_value("SMTP_PORT")
    username = env_value("SMTP_USER")
    from_email = env_value("FROM_EMAIL")
    timeout = timeout_seconds or _smtp_timeout_seconds()
    ports = []

    for value in (configured_port, "587", "465"):
        try:
            port = int(value)
        except (TypeError, ValueError):
            continue
        if port not in ports:
            ports.append(port)

    checks = []
    for port in ports:
        started_at = time.monotonic()
        step = "smtp_ssl_connect" if port == 465 else "smtp_starttls_connect"
        payload = {
            "port": port,
            "mode": "SMTP_SSL" if port == 465 else "SMTP_STARTTLS",
            "ok": False,
        }
        try:
            if port == 465:
                with smtplib.SMTP_SSL(host, port, timeout=timeout) as smtp:
                    _set_smtp_socket_timeout(smtp, timeout)
                    smtp.ehlo()
            else:
                with smtplib.SMTP(host, port, timeout=timeout) as smtp:
                    _set_smtp_socket_timeout(smtp, timeout)
                    smtp.ehlo()
                    smtp.starttls()
                    _set_smtp_socket_timeout(smtp, timeout)
                    smtp.ehlo()
            payload["ok"] = True
        except (socket.timeout, TimeoutError, OSError, smtplib.SMTPException, SystemExit) as exc:
            payload.update(_smtp_safe_error(exc))
            if getattr(exc, "errno", None) == 101:
                payload["diagnosis"] = "Network is unreachable from this runtime to the SMTP server."
        except Exception as exc:
            payload.update(_smtp_safe_error(exc))
        payload["elapsed_ms"] = int((time.monotonic() - started_at) * 1000)
        payload["step"] = step
        checks.append(payload)

    any_ok = any(item.get("ok") for item in checks)
    all_network_unreachable = checks and all(item.get("errno") == 101 for item in checks)
    diagnosis = ""
    if all_network_unreachable:
        diagnosis = (
            "Outbound SMTP ports are unreachable from this runtime. On Render Free web "
            "services, outbound traffic to SMTP ports 25, 465, and 587 is blocked."
        )
    elif not any_ok:
        diagnosis = "SMTP is not reachable with the current production network/configuration."

    return {
        "ok": any_ok,
        "provider": "smtp",
        "host": host or "<missing>",
        "configuredPort": configured_port or "<missing>",
        "timeoutSeconds": timeout,
        "smtpUserPresent": bool(username),
        "fromEmailPresent": bool(from_email),
        "fromEmailMatchesSmtpUser": bool(username and from_email and username.lower() == from_email.lower()),
        "checks": checks,
        "diagnosis": diagnosis,
    }


def _send_email_via_resend(to_email, content):
    api_key = env_value("RESEND_API_KEY")
    from_email = env_value("RESEND_FROM_EMAIL") or env_value("FROM_EMAIL")
    from_name = env_value("RESEND_FROM_NAME") or sender_name()
    reply_to = (support_email() or from_email or "").strip()

    body_json = {
        "from": f"{from_name} <{from_email}>",
        "to": [to_email],
        "subject": content.subject,
        "html": content.html_body,
        "text": content.text_body,
    }
    if reply_to:
        body_json["reply_to"] = reply_to

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body_json,
            timeout=30,
        )
    except Exception as exc:
        payload = _safe_exception_payload("resend_request", exc)
        payload["error"] = "Resend email request failed."
        return payload

    if not response.ok:
        payload = {
            "ok": False,
            "step": "resend_send",
            "errorType": "ResendSendError",
            "error": f"Resend email failed with status {response.status_code}.",
            "status": response.status_code,
        }
        try:
            body = response.json()
            api_name = (body.get("name") or "").strip()
            if api_name:
                payload["errorType"] = api_name
            raw_msg = body.get("message")
            if isinstance(raw_msg, list) and raw_msg:
                message = " ".join(str(x) for x in raw_msg if x)[:500]
            else:
                message = (str(raw_msg or body.get("error") or "")[:500]).strip()
            if message:
                payload["message"] = message
        except Exception:
            snippet = (response.text or "")[:500].strip()
            if snippet:
                payload["message"] = snippet
        print(
            "Resend API error:",
            f"status={response.status_code}",
            f"errorType={payload.get('errorType') or 'ResendSendError'}",
            flush=True,
        )
        return payload

    return {
        "ok": True,
        "provider": "resend",
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
    url = action_url or _default_url("/#/")
    lines = [
        "Your password was successfully changed.",
        "If you made this change, no further action is required.",
        "If this was not you, secure your account immediately.",
    ]
    return EmailContent(
        subject="Your password has been updated",
        html_body=_render_template(
            title="Your password has been updated",
            message=lines,
            button_text="Go to WeCast",
            button_url=url,
            eyebrow="Security confirmation",
            notice_text="",
        ),
        text_body=_text_body(*lines),
    )


def send_password_changed_email(email, action_url=None, *, dry_run=False):
    return _send_email(email, _password_changed_content(action_url), dry_run=dry_run)


def _confirm_new_email_content(previous_email):
    """Variant 4 (post-approval): informational notice to the new address only. No approval links."""
    url = _public_login_url()
    prev = (previous_email or "").strip()
    lines = [
        "Your WeCast sign-in email has been updated to this address.",
        "The change was approved from your previous email address on file.",
        "Sign in with this email address going forward.",
    ]
    detail_lines = [f"Previous sign-in email: {prev}"] if prev else None
    return EmailContent(
        subject="Your WeCast sign-in email was updated",
        html_body=_render_template(
            title="Your sign-in email is updated",
            message=lines,
            button_text="Sign in to WeCast",
            button_url=url,
            eyebrow="Email change",
            detail_label="Account details",
            detail_lines=detail_lines,
            notice_text="This message is for your records only. It cannot approve or change your email.",
        ),
        text_body=_text_body(*lines, button_url=url),
    )


def send_confirm_new_email(new_email, current_email="", action_url=None, *, dry_run=False):
    """Variant 4: after the old email approves, notify the new address (informational only; action_url is ignored)."""
    _ = action_url  # Never embed tokenized or takeover-capable links in this notice.
    content = _confirm_new_email_content(current_email)
    return _send_email(new_email, content, dry_run=dry_run)


def _email_change_requested_content(action_url, new_email, approve_url=""):
    cancel_url = action_url or _default_url("/#/account?section=security")
    approve_link = (approve_url or "").strip()
    lines = [
        "A request was made to change the email address on your WeCast account.",
        "Your current email must approve this request before any account email can change.",
        "If this was not you, cancel the request immediately and change your password.",
    ]
    return EmailContent(
        subject="Email Change Requested",
        html_body=_render_template(
            title="A request was made to change your email",
            message=lines,
            button_text="Approve email change" if approve_link else "Cancel email change",
            button_url=approve_link or cancel_url,
            secondary_button_text="Cancel email change" if approve_link else "",
            secondary_button_url=cancel_url if approve_link else "",
            eyebrow="Security notice",
            detail_label="Requested new email",
            detail_lines=[new_email] if new_email else None,
            notice_text="Your current email remains active unless you approve this request.",
        ),
        text_body=_text_body(
            *lines,
            "Approve email change:",
            approve_link,
            "Cancel email change:",
            cancel_url,
        ),
    )


def send_email_change_requested(old_email, new_email="", action_url=None, approve_url=None, *, dry_run=False):
    content = _email_change_requested_content(action_url, new_email, approve_url=approve_url)
    return _send_email(old_email, content, dry_run=dry_run)


def _email_changed_success_content(action_url, old_email, new_email):
    url = action_url or ""
    lines = [
        "This confirms that the email address on your WeCast account was changed successfully.",
        "If this was not you, contact support immediately so we can help protect your account.",
    ]
    return EmailContent(
        subject="Email Changed Successfully",
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
