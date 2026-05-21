import html
import os
from urllib.parse import urlparse


DEFAULT_EMAIL_LOGO_URL = "https://wecastsa.com/logo.png"


def _escape(value, *, quote=False):
    return html.escape(str(value or "").strip(), quote=quote)


def _message_html(message):
    lines = message if isinstance(message, (list, tuple)) else [message]
    return "".join(
        (
            '<p style="margin:0 0 12px;color:#4c5566;font-size:16px;'
            'line-height:1.75;font-weight:400;">'
            f"{_escape(line)}</p>"
        )
        for line in lines
        if str(line or "").strip()
    )


def _safe_public_logo_url(value=None):
    candidate = str(
        value
        or os.getenv("WECAST_LOGO_URL")
        or DEFAULT_EMAIL_LOGO_URL
    ).strip()
    parsed = urlparse(candidate)
    host = (parsed.hostname or "").lower()
    if parsed.scheme == "https" and parsed.netloc and host not in {"localhost", "127.0.0.1"}:
        return candidate
    return DEFAULT_EMAIL_LOGO_URL


def _detail_html(detail_label, detail_lines):
    lines = detail_lines if isinstance(detail_lines, (list, tuple)) else [detail_lines]
    rows = "".join(
        (
            "<tr>"
            '<td style="padding:0 0 8px;color:#596171;font-size:14px;line-height:1.65;">'
            f"{_escape(line)}</td>"
            "</tr>"
        )
        for line in lines
        if str(line or "").strip()
    )
    if not rows:
        return ""

    safe_label = _escape(detail_label or "Details")
    return f"""
                        <tr>
                          <td style="padding:24px 0 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f4ee;border:1px solid #e9ddca;border-radius:18px;">
                              <tr>
                                <td style="padding:16px 18px 8px;">
                                  <div style="margin:0 0 10px;color:#7a5d1f;font-size:12px;line-height:1.2;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">{safe_label}</div>
                                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                    {rows}
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>"""


def generate_wecast_email_template(
    title,
    message,
    button_text,
    button_url,
    *,
    logo_url=None,
    support_email=None,
    eyebrow="WeCast Account",
    notice_text="This secure link helps protect your WeCast account. If you did not request this email, you can safely ignore it.",
    footer_text="WeCast sends account emails for security and sign-in actions.",
    detail_label="",
    detail_lines=None,
    secondary_button_text="",
    secondary_button_url="",
):
    """Return a complete branded WeCast HTML email."""
    safe_title = _escape(title or "WeCast")
    safe_button_text = _escape(button_text)
    safe_button_url = _escape(button_url, quote=True)
    safe_secondary_button_text = _escape(secondary_button_text)
    safe_secondary_button_url = _escape(secondary_button_url, quote=True)
    safe_eyebrow = _escape(eyebrow or "WeCast Account")
    safe_notice_text = _escape(notice_text)
    safe_footer_text = _escape(footer_text)
    safe_logo_url = _escape(_safe_public_logo_url(logo_url), quote=True)
    safe_support_email = _escape(
        support_email
        or os.getenv("WECAST_SUPPORT_EMAIL")
        or os.getenv("RESEND_FROM_EMAIL")
        or "support@wecast.app"
    )

    button_block = ""
    if safe_button_text and safe_button_url:
        # Table layout: reliable in Gmail; equal visual weight for paired CTAs.
        primary_styles = (
            "display:block;background:#17131f;color:#ffffff;text-decoration:none;"
            "border-radius:12px;padding:11px 22px;font-size:14px;line-height:1.35;"
            "font-weight:600;letter-spacing:0.01em;text-align:center;"
            "box-shadow:0 4px 14px rgba(23,19,31,0.14);box-sizing:border-box;"
            "min-width:148px;white-space:nowrap;"
        )
        secondary_styles = (
            "display:block;background:#faf9ff;color:#4c3d78;text-decoration:none;"
            "border-radius:12px;padding:11px 22px;font-size:14px;line-height:1.35;"
            "font-weight:600;letter-spacing:0.01em;text-align:center;"
            "border:1px solid #d4c8ec;box-sizing:border-box;"
            "min-width:148px;white-space:nowrap;"
        )
        if safe_secondary_button_text and safe_secondary_button_url:
            button_block = f"""
                        <tr>
                          <td align="center" style="padding:26px 0 0;">
                            <table role="presentation" class="wecast-btn-stack" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                              <tr>
                                <td align="center" valign="middle" style="padding:0 8px 10px 0;">
                                  <a class="wecast-button wecast-btn-primary" href="{safe_button_url}" target="_blank" style="{primary_styles}">
                                    {safe_button_text}
                                  </a>
                                </td>
                                <td align="center" valign="middle" style="padding:0 0 10px 8px;">
                                  <a class="wecast-button wecast-btn-secondary" href="{safe_secondary_button_url}" target="_blank" style="{secondary_styles}">
                                    {safe_secondary_button_text}
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>"""
        else:
            single_styles = (
                "display:inline-block;background:#17131f;color:#ffffff;text-decoration:none;"
                "border-radius:12px;padding:12px 26px;font-size:14px;line-height:1.35;"
                "font-weight:600;letter-spacing:0.01em;text-align:center;"
                "box-shadow:0 4px 16px rgba(23,19,31,0.15);"
            )
            button_block = f"""
                        <tr>
                          <td align="center" style="padding:26px 0 0;">
                            <a class="wecast-button" href="{safe_button_url}" target="_blank" style="{single_styles}">
                              {safe_button_text}
                            </a>
                          </td>
                        </tr>"""

    notice_block = ""
    if safe_notice_text:
        notice_block = f"""
                        <tr>
                          <td style="padding:30px 0 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fbf8f2;border:1px solid #eee2cc;border-radius:18px;">
                              <tr>
                                <td style="padding:16px 18px;">
                                  <p style="margin:0;color:#6d7480;font-size:13px;line-height:1.65;">
                                    {safe_notice_text}
                                  </p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>"""

    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <title>{safe_title}</title>
    <style>
      @media only screen and (max-width: 620px) {{
        .wecast-shell {{ width: 100% !important; }}
        .wecast-card {{ border-radius: 24px !important; }}
        .wecast-pad {{ padding: 30px 22px !important; }}
        .wecast-title {{ font-size: 30px !important; line-height: 1.16 !important; }}
        .wecast-btn-stack tr {{ display: block !important; }}
        .wecast-btn-stack td {{ display: block !important; width: 100% !important; padding: 0 0 10px 0 !important; max-width: 100% !important; }}
        .wecast-button {{ width: 100% !important; max-width: 100% !important; text-align: center !important; white-space: normal !important; box-sizing: border-box !important; }}
      }}
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f5f1ea;color:#141414;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f1ea;margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" class="wecast-shell" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;">
            <tr>
              <td align="center" style="padding:0 0 18px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                  <tr>
                    <td style="padding:0 10px 0 0;vertical-align:middle;">
                      <img src="{safe_logo_url}" width="50" height="48" alt="WeCast" style="display:block;border:0;outline:none;text-decoration:none;width:50px;height:48px;">
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="color:#17131f;font-size:24px;line-height:1;font-weight:850;letter-spacing:0;">WeCast</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="wecast-card" style="background:#ffffff;border:1px solid #eadfcd;border-radius:32px;overflow:hidden;box-shadow:0 22px 60px rgba(61,47,25,0.12);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="height:8px;background:#5b2bd8;background:linear-gradient(90deg,#4f46e5 0%,#9b5cff 48%,#f0b84f 100%);font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td class="wecast-pad" style="padding:42px 42px 34px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="center" style="padding:0 0 10px;">
                            <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:#f7f1ff;color:#5b2bd8;font-size:12px;line-height:1.2;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                              {safe_eyebrow}
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:8px 0 0;">
                            <h1 class="wecast-title" style="margin:0;color:#15121f;font-size:38px;line-height:1.12;font-weight:800;letter-spacing:0;">
                              {safe_title}
                            </h1>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:18px 0 0;">
                            {_message_html(message)}
                          </td>
                        </tr>{_detail_html(detail_label, detail_lines)}{button_block}{notice_block}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 20px 0;">
                <p style="margin:0;color:#7b735f;font-size:12px;line-height:1.7;">
                  Need help? Contact <a href="mailto:{safe_support_email}" style="color:#5b2bd8;text-decoration:underline;">{safe_support_email}</a>.
                </p>
                <p style="margin:8px 0 0;color:#9a927f;font-size:12px;line-height:1.7;">
                  {safe_footer_text}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def generate_verify_email_template(button_url, **kwargs):
    return generate_wecast_email_template(
        "Verify your email",
        "Welcome to WeCast. Confirm your email address so we can keep your account secure and help you access your podcast workspace.",
        "Verify Email",
        button_url,
        **kwargs,
    )


def generate_reset_password_template(button_url, **kwargs):
    return generate_wecast_email_template(
        "Reset your password",
        [
            "We received a request to reset the password for your WeCast account.",
            "Use the button below to choose a new password. If you did not request this, you can safely ignore this email.",
        ],
        "Reset Password",
        button_url,
        notice_text="For your security, this reset link should only be used by you. If you did not request it, no action is needed.",
        **kwargs,
    )


def generate_password_changed_template(button_url="", **kwargs):
    return generate_wecast_email_template(
        "Your password has been updated",
        [
            "Your password was successfully changed.",
            "If you made this change, no further action is required.",
            "If this was not you, secure your account immediately.",
        ],
        "Go to WeCast" if button_url else "",
        button_url,
        eyebrow="Security confirmation",
        notice_text="",
        **kwargs,
    )


def generate_confirm_new_email_template(button_url, current_email="current@example.com", **kwargs):
    """Variant 4 (after approval): informational notice to the new address only."""
    return generate_wecast_email_template(
        "Your sign-in email is updated",
        [
            "Your WeCast sign-in email has been updated to this address.",
            "The change was approved from your previous email address on file.",
            "Sign in with this email address going forward.",
        ],
        "Sign in to WeCast",
        button_url,
        eyebrow="Email change",
        detail_label="Account details",
        detail_lines=[f"Previous sign-in email: {current_email}"] if current_email else None,
        notice_text="This message is for your records only. It cannot approve or change your email.",
        **kwargs,
    )


def generate_email_change_requested_template(button_url, new_email="new@example.com", approve_url="", **kwargs):
    return generate_wecast_email_template(
        "A request was made to change your email",
        [
            "A request was made to change the email address on your WeCast account.",
            "Your current email address must approve this request before any account email can change.",
            "If this was not you, cancel the request immediately and change your password.",
        ],
        "Approve email change" if approve_url else "Cancel email change",
        approve_url or button_url,
        eyebrow="Security notice",
        detail_label="Requested new email",
        detail_lines=[new_email],
        secondary_button_text="Cancel email change" if approve_url else "",
        secondary_button_url=button_url if approve_url else "",
        notice_text="Your current email remains active unless you approve this request.",
        **kwargs,
    )


def generate_email_changed_success_template(
    button_url="",
    old_email="old@example.com",
    new_email="new@example.com",
    **kwargs,
):
    return generate_wecast_email_template(
        "Your account email was changed",
        [
            "This confirms that the email address on your WeCast account was changed successfully.",
            "If this was not you, contact support immediately so we can help protect your account.",
        ],
        "Contact Support" if button_url else "",
        button_url,
        eyebrow="Security confirmation",
        detail_label="Email change",
        detail_lines=[
            f"Previous email: {old_email}",
            f"New email: {new_email}",
        ],
        notice_text="You may need to sign in again using the new email address.",
        **kwargs,
    )
