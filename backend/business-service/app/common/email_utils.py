import smtplib
import anyio
import os
import socket
import time
from html import escape
from typing import Iterable
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
from app.config.settings import get_settings
from app.logging.logger import get_logger

logger = get_logger(__name__)

def _smtp_transports(settings):
    """Retry the configured transport, then try Gmail's SSL fallback."""
    configured = (settings.email_port, settings.email_port == 465)
    yield configured
    yield configured
    if configured != (465, True):
        yield (465, True)


def render_premium_email(
    *,
    eyebrow: str,
    title: str,
    greeting: str,
    intro: str,
    details: Iterable[tuple[str, str]] = (),
    items: Iterable[dict[str, str]] = (),
    credentials: Iterable[tuple[str, str]] = (),
    primary_cta: tuple[str, str] | None = None,
    secondary_cta: tuple[str, str] | None = None,
    note: str | None = None,
    signoff: str = "NexusWMS Procurement Team",
) -> str:
    """Build a responsive, email-client-safe branded transactional email."""
    detail_cells = list(details)
    detail_rows = "".join(
        "<tr>" + "".join(
            f'<td style="padding:0 6px 12px;width:50%;vertical-align:top"><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px"><div style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">{escape(label)}</div><div style="color:#0f172a;font-size:15px;font-weight:700;margin-top:5px">{escape(str(value))}</div></div></td>'
            for label, value in detail_cells[index:index + 2]
        ) + ("<td style='width:50%'></td>" if len(detail_cells[index:index + 2]) == 1 else "") + "</tr>"
        for index in range(0, len(detail_cells), 2)
    )
    item_rows = "".join(
        f'<tr><td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#0f172a;font-weight:700">{escape(str(item.get("material", "—")))}</td><td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#334155">{escape(str(item.get("quantity", "—")))}</td><td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#334155">{escape(str(item.get("delivery", "—")))}</td><td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#334155">{escape(str(item.get("warehouse", "—")))}</td></tr>'
        for item in items
    )
    items_html = f'''<div style="margin:24px 0"><div style="font-size:14px;font-weight:800;color:#2563eb;margin-bottom:12px;text-decoration:underline">Requested materials</div><div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px"><tr style="background:#f1f5f9"><th align="left" style="padding:11px 12px;color:#475569;font-weight:700">Material</th><th align="left" style="padding:11px 12px;color:#475569;font-weight:700">Quantity</th><th align="left" style="padding:11px 12px;color:#475569;font-weight:700">Required by</th><th align="left" style="padding:11px 12px;color:#475569;font-weight:700">Warehouse</th></tr>{item_rows}</table></div></div>''' if item_rows else ""
    credential_rows = "".join(
        f'<tr><td style="padding:5px 0;color:#64748b;font-size:13px">{escape(label)}</td><td align="right" style="padding:5px 0;color:#0f172a;font:700 14px monospace">{escape(str(value))}</td></tr>'
        for label, value in credentials
    )
    credentials_html = f'''<div style="margin:22px 0;background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:16px 18px"><div style="color:#92400e;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-bottom:7px">Secure portal access</div><table role="presentation" width="100%">{credential_rows}</table><div style="color:#92400e;font-size:11px;line-height:1.5;margin-top:8px">Keep these credentials private. You may be asked to update the temporary password after signing in.</div></div>''' if credential_rows else ""
    buttons = ""
    if primary_cta:
        buttons += f'<a href="{escape(primary_cta[1], quote=True)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;padding:13px 20px;border-radius:10px;margin:0 8px 8px 0">{escape(primary_cta[0])}</a>'
    if secondary_cta:
        buttons += f'<a href="{escape(secondary_cta[1], quote=True)}" style="display:inline-block;background:#ffffff;color:#1e40af;text-decoration:none;font-size:14px;font-weight:800;padding:12px 19px;border:1px solid #bfdbfe;border-radius:10px;margin:0 0 8px">{escape(secondary_cta[0])}</a>'
    note_html = f'<div style="margin-top:22px;padding:14px 16px;border-left:4px solid #3b82f6;background:#eff6ff;color:#1e3a8a;font-size:13px;line-height:1.6">{escape(note)}</div>' if note else ""
    return f'''<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><div style="display:none;max-height:0;overflow:hidden">{escape(intro)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08)"><tr><td style="padding:28px 34px;background:linear-gradient(135deg,#0f172a,#1e3a8a)"><div style="color:#93c5fd;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">NEXUS<span style="color:#ffffff">WMS</span> · {escape(eyebrow)}</div><h1 style="margin:12px 0 0;color:#ffffff;font-size:28px;line-height:1.25">{escape(title)}</h1></td></tr><tr><td style="padding:32px 34px"><p style="margin:0 0 12px;font-size:16px;font-weight:700">{escape(greeting)}</p><p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7;white-space:pre-line">{escape(intro)}</p>{f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 -6px 12px">{detail_rows}</table>' if detail_rows else ''}{items_html}{credentials_html}<div style="margin-top:24px">{buttons}</div>{note_html}<p style="margin:28px 0 0;color:#475569;font-size:13px;line-height:1.6">Regards,<br><strong style="color:#0f172a">{escape(signoff)}</strong></p></td></tr><tr><td align="center" style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;line-height:1.6">This is an automated transactional message from NexusWMS.<br>Please do not share secure portal credentials.</td></tr></table></td></tr></table></body></html>'''


def _send_sync(to_email: str, subject: str, body: str, html_body: str | None = None):
    settings = get_settings()

    # Absolute path for debugging
    log_path = os.path.abspath(os.path.join("media_uploads", "smtp_debug.txt"))
    with open(log_path, "a") as lf:
        lf.write(f"SMTP Start: {to_email} via {settings.email_host_user}\n")

    # Let Gmail, Outlook, and mobile clients prefer the premium HTML while
    # retaining the plain-text version as an accessibility fallback.
    msg = MIMEMultipart('alternative')
    msg['From'] = f"{settings.email_from_name} <{settings.email_host_user}>"
    msg['To'] = to_email
    msg['Subject'] = subject
    msg['Date'] = formatdate(localtime=True)
    msg['Message-ID'] = make_msgid(domain=settings.email_host_user.split('@')[-1])
    msg['Auto-Submitted'] = 'auto-generated'
    msg.attach(MIMEText(body, 'plain', 'utf-8'))
    if html_body:
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))

    errors = []
    for attempt, (port, use_ssl) in enumerate(_smtp_transports(settings), start=1):
        server = None
        try:
            if use_ssl:
                server = smtplib.SMTP_SSL(settings.email_host, port, timeout=15)
            else:
                server = smtplib.SMTP(settings.email_host, port, timeout=15)
                server.ehlo()
                server.starttls()
                server.ehlo()
            server.login(settings.email_host_user, settings.email_host_password)
            server.send_message(msg)
            # Delivery has completed once send_message returns. A timeout while
            # closing must not trigger another attempt and duplicate the email.
            try:
                server.quit()
            except (OSError, smtplib.SMTPException, socket.error):
                server.close()
            with open(log_path, "a") as lf:
                lf.write(f"SMTP Success: {to_email} via port {port}\n")
            return True
        except (OSError, smtplib.SMTPException, socket.error) as smtp_err:
            errors.append(f"port {port}: {smtp_err}")
            if server is not None:
                try:
                    server.close()
                except Exception:
                    pass
            if attempt == 1:
                time.sleep(1)

    error_message = "; ".join(errors)
    with open(log_path, "a") as lf:
        lf.write(f"SMTP Error: {error_message}\n")
    raise RuntimeError(error_message)

async def send_email(to_email: str, subject: str, body: str, html_body: str | None = None):
    """
    Sends an email using SMTP settings from the configuration.
    """
    settings = get_settings()

    if (
        not settings.email_host_user
        or "@" not in settings.email_host_user
        or "your_email" in settings.email_host_user.lower()
        or not settings.email_host_password
        or "your_app_password" in settings.email_host_password.lower()
    ):
        logger.warning("SMTP credentials not configured or using placeholder. Skipping live email dispatch.")
        return False

    try:
        if html_body is None:
            html_body = render_premium_email(
                eyebrow="Notification",
                title=subject,
                greeting="Hello,",
                intro=body,
            )
        # Run synchronous smtplib in a separate thread
        await anyio.to_thread.run_sync(_send_sync, to_email, subject, body, html_body)
        return True
    except Exception as e:
        logger.error(f"Email failed: {e}")
        raise
