import html
import os


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
):
    """Return a complete branded WeCast HTML email."""
    safe_title = _escape(title or "WeCast")
    safe_button_text = _escape(button_text)
    safe_button_url = _escape(button_url, quote=True)
    safe_eyebrow = _escape(eyebrow or "WeCast Account")
    safe_notice_text = _escape(notice_text)
    safe_footer_text = _escape(footer_text)
    safe_logo_url = _escape(
        logo_url
        or os.getenv("WECAST_LOGO_URL")
        or "https://wecast-frontend.onrender.com/logo.png",
        quote=True,
    )
    safe_support_email = _escape(
        support_email
        or os.getenv("WECAST_SUPPORT_EMAIL")
        or os.getenv("RESEND_FROM_EMAIL")
        or "support@wecast.app"
    )

    button_block = ""
    fallback_block = ""
    if safe_button_text and safe_button_url:
        button_block = f"""
                        <tr>
                          <td align="center" style="padding:30px 0 0;">
                            <a class="wecast-button" href="{safe_button_url}" target="_blank" style="display:inline-block;background:#17131f;color:#ffffff;text-decoration:none;border-radius:16px;padding:15px 28px;font-size:16px;line-height:1;font-weight:800;box-shadow:0 12px 24px rgba(23,19,31,0.18);">
                              {safe_button_text}
                            </a>
                          </td>
                        </tr>"""
        fallback_block = f"""
                        <tr>
                          <td align="center" style="padding:22px 0 0;">
                            <p style="margin:0;color:#747b8a;font-size:13px;line-height:1.65;">
                              If the button does not work, use this link:
                              <a href="{safe_button_url}" target="_blank" style="color:#5b2bd8;text-decoration:underline;font-weight:700;">Open secure link</a>
                            </p>
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
        .wecast-button {{ width: 100% !important; text-align: center !important; }}
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
                        </tr>{_detail_html(detail_label, detail_lines)}{button_block}{fallback_block}{notice_block}
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
        "Your password was changed",
        [
            "This confirms that the password for your WeCast account was changed successfully.",
            "If this was you, no further action is needed. If this was not you, contact support immediately so we can help protect your account.",
        ],
        "Review Account Security" if button_url else "",
        button_url,
        eyebrow="Security confirmation",
        notice_text="Keep your account secure by using a unique password and signing out of shared devices.",
        **kwargs,
    )


def generate_confirm_new_email_template(button_url, current_email="current@example.com", **kwargs):
    return generate_wecast_email_template(
        "Confirm your new email",
        [
            "A request was made to change the email address on your WeCast account.",
            "Your current login email will remain active until this new email address is verified.",
            "If you did not request this change, you can ignore this email.",
        ],
        "Confirm New Email",
        button_url,
        eyebrow="Email change",
        detail_label="Current account email",
        detail_lines=[current_email],
        notice_text="The account email will not change unless this new email address is confirmed.",
        **kwargs,
    )


def generate_email_change_requested_template(button_url, new_email="new@example.com", **kwargs):
    return generate_wecast_email_template(
        "A request was made to change your email",
        [
            "A request was made to change the email address on your WeCast account.",
            "No change will happen unless the new email address is verified.",
            "If this was not you, secure your account immediately.",
        ],
        "Secure My Account",
        button_url,
        eyebrow="Security notice",
        detail_label="Requested new email",
        detail_lines=[new_email],
        notice_text="Your current email remains active while this request is pending.",
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
