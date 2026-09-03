import smtplib
import anyio
import os
import socket
import platform
from html import escape
from typing import Iterable
from email import encoders
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formatdate, make_msgid
from app.config.settings import get_settings
from app.logging.logger import get_logger

logger = get_logger(__name__)

# Windows-specific socket error codes
WINSOCK_ERRORS = {
    10013: "Permission denied - Check Windows Firewall/Antivirus SMTP port rules",
    11001: "getaddrinfo failed - DNS resolution issue",
    10061: "Connection refused - SMTP server not accepting connections",
}

def _smtp_transports(settings):
    """Try the configured transport, then Gmail's SSL fallback once."""
    configured = (settings.email_port, settings.email_port == 465)
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
<<<<<<< HEAD
    items_title: str = "Requested materials",
    col_headers: Iterable[str] = ("Material", "Quantity", "Required by", "Warehouse"),
=======
    items_heading: str | None = "Requested materials",
>>>>>>> main
    credentials: Iterable[tuple[str, str]] = (),
    primary_cta: tuple[str, str] | None = None,
    secondary_cta: tuple[str, str] | None = None,
    note: str | None = None,
    custom_html: str | None = None,
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
<<<<<<< HEAD
    headers_list = list(col_headers)
    num_cols = len(headers_list)

    if num_cols == 3:
        th_cells = (
            f'<th align="left" style="padding:11px 12px;color:#475569;font-weight:700;width:38%">{escape(headers_list[0])}</th>'
            f'<th align="left" style="padding:11px 12px;color:#475569;font-weight:700;width:24%">{escape(headers_list[1])}</th>'
            f'<th align="left" style="padding:11px 12px;color:#475569;font-weight:700;width:38%">{escape(headers_list[2])}</th>'
        )
        item_rows = "".join(
            f'<tr>'
            f'<td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#0f172a;font-weight:700;vertical-align:top">{escape(str(item.get("material", "—")))}</td>'
            f'<td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#dc2626;font-weight:700;vertical-align:top">{escape(str(item.get("quantity", "—")))}</td>'
            f'<td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#334155;vertical-align:top">{escape(str(item.get("delivery", item.get("reason", "—"))))}</td>'
            f'</tr>'
            for item in items
        )
    else:
        th_cells = "".join(
            f'<th align="left" style="padding:11px 12px;color:#475569;font-weight:700">{escape(h)}</th>'
            for h in headers_list
        )
        item_rows = "".join(
            f'<tr><td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#0f172a;font-weight:700">{escape(str(item.get("material", "—")))}</td><td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#dc2626;font-weight:700">{escape(str(item.get("quantity", "—")))}</td><td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#334155">{escape(str(item.get("delivery", "—")))}</td><td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#334155">{escape(str(item.get("warehouse", "—")))}</td></tr>'
            for item in items
        )
    items_html = f'''<div style="margin:24px 0"><div style="font-size:14px;font-weight:800;color:#dc2626;margin-bottom:12px;text-decoration:underline">{escape(items_title)}</div><div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;table-layout:fixed"><tr style="background:#f1f5f9">{th_cells}</tr>{item_rows}</table></div></div>''' if item_rows else ""
    custom_section = f'''<div style="margin:20px 0">{custom_html}</div>''' if custom_html else ""
=======
    item_rows = "".join(
        f'<tr><td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#0f172a;font-weight:700">{escape(str(item.get("material", "—")))}</td><td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#334155">{escape(str(item.get("quantity", "—")))}</td><td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#334155">{escape(str(item.get("delivery", "—")))}</td><td style="padding:13px 12px;border-top:1px solid #e2e8f0;color:#334155">{escape(str(item.get("warehouse", "—")))}</td></tr>'
        for item in items
    )
    items_title_html = (
        f'<div style="font-size:14px;font-weight:800;color:#2563eb;margin-bottom:12px;text-decoration:underline">{escape(items_heading)}</div>'
        if items_heading
        else ""
    )
    items_html = f'''<div style="margin:24px 0">{items_title_html}<div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px"><tr style="background:#f1f5f9"><th align="left" style="padding:11px 12px;color:#475569;font-weight:700">Material</th><th align="left" style="padding:11px 12px;color:#475569;font-weight:700">Quantity</th><th align="left" style="padding:11px 12px;color:#475569;font-weight:700">Required by</th><th align="left" style="padding:11px 12px;color:#475569;font-weight:700">Warehouse</th></tr>{item_rows}</table></div></div>''' if item_rows else ""
>>>>>>> main
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
    return f'''<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><div style="display:none;max-height:0;overflow:hidden">{escape(intro)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08)"><tr><td style="padding:28px 34px;background:linear-gradient(135deg,#0f172a,#1e3a8a)"><div style="color:#93c5fd;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">NEXUS<span style="color:#ffffff">WMS</span> · {escape(eyebrow)}</div><h1 style="margin:12px 0 0;color:#ffffff;font-size:28px;line-height:1.25">{escape(title)}</h1></td></tr><tr><td style="padding:32px 34px"><p style="margin:0 0 12px;font-size:16px;font-weight:700">{escape(greeting)}</p><p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7;white-space:pre-line">{escape(intro)}</p>{f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 -6px 12px">{detail_rows}</table>' if detail_rows else ''}{items_html}{custom_section}{credentials_html}<div style="margin-top:24px">{buttons}</div>{note_html}<p style="margin:28px 0 0;color:#475569;font-size:13px;line-height:1.6">Regards,<br><strong style="color:#0f172a">{escape(signoff)}</strong></p></td></tr><tr><td align="center" style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;line-height:1.6">This is an automated transactional message from NexusWMS.<br>Please do not share secure portal credentials.</td></tr></table></td></tr></table></body></html>'''


<<<<<<< HEAD
def _send_sync(to_email: str, subject: str, body: str, html_body: str | None = None, attachments: list[tuple[str, bytes, str]] | None = None):
    settings = get_settings()

    host_user = settings.email_host_user.strip() if settings.email_host_user else ""
    host_pass = settings.email_host_password.replace(" ", "").strip() if settings.email_host_password else ""

=======
def _send_sync(
    to_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
    attachments: Iterable[tuple[str, bytes, str]] = (),
):
    settings = get_settings()

    # Absolute path for debugging
>>>>>>> main
    log_path = os.path.abspath(os.path.join("media_uploads", "smtp_debug.txt"))
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    with open(log_path, "a") as lf:
        lf.write(f"SMTP Start: {to_email} via {host_user}\n")

<<<<<<< HEAD
    msg_id = make_msgid(domain=host_user.split('@')[-1] if '@' in host_user else 'gmail.com')

    msg = MIMEMultipart('mixed')
    alternative = MIMEMultipart('alternative')
    msg.attach(alternative)
    msg['From'] = f"{settings.email_from_name} <{host_user}>"
=======
    # Let Gmail, Outlook, and mobile clients prefer the premium HTML while
    # retaining the plain-text version as an accessibility fallback.
    msg = MIMEMultipart('mixed')
    msg['From'] = f"{settings.email_from_name} <{settings.email_host_user}>"
>>>>>>> main
    msg['To'] = to_email
    msg['Subject'] = subject
    msg['Date'] = formatdate(localtime=True)
    msg['Message-ID'] = msg_id
    msg['Auto-Submitted'] = 'auto-generated'
<<<<<<< HEAD
    alternative.attach(MIMEText(body, 'plain', 'utf-8'))
    if html_body:
        alternative.attach(MIMEText(html_body, 'html', 'utf-8'))
    for filename, content, mime_type in attachments or []:
        maintype, subtype = mime_type.split('/', 1)
        part = MIMEBase(maintype, subtype)
        part.set_payload(content)
=======
    alternatives = MIMEMultipart('alternative')
    alternatives.attach(MIMEText(body, 'plain', 'utf-8'))
    if html_body:
        alternatives.attach(MIMEText(html_body, 'html', 'utf-8'))
    msg.attach(alternatives)
    for filename, data, content_type in attachments:
        main_type, _, sub_type = (content_type or "application/octet-stream").partition("/")
        part = MIMEBase(main_type or "application", sub_type or "octet-stream")
        part.set_payload(data)
>>>>>>> main
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', 'attachment', filename=filename)
        msg.attach(part)

    errors = []
    for port, use_ssl in _smtp_transports(settings):
        server = None
        send_started = False
        try:
            logger.info(f"Connecting to SMTP server {settings.email_host}:{port} (SSL={use_ssl}) for recipient {to_email}")
            if use_ssl:
                server = smtplib.SMTP_SSL(settings.email_host, port, timeout=settings.email_timeout_seconds)
            else:
                server = smtplib.SMTP(settings.email_host, port, timeout=settings.email_timeout_seconds)
                server.ehlo()
                server.starttls()
                server.ehlo()
<<<<<<< HEAD
            server.login(host_user, host_pass)
            logger.info(f"SMTP authentication successful as {host_user}. Dispatching message ID {msg_id}")
            send_started = True
            refused = server.send_message(msg)
            if refused:
                raise smtplib.SMTPRecipientsRefused(refused)
            try:
                server.quit()
            except Exception:
                server.close()
            logger.info(f"SMTP server accepted message for {to_email} via port {port}. Message-ID: {msg_id}")
            try:
                with open(log_path, "a") as lf:
                    lf.write(f"SMTP Success: {to_email} via port {port} (Message-ID: {msg_id})\n")
            except OSError:
                pass
            return True
        except (OSError, smtplib.SMTPException, socket.error) as smtp_err:
            if send_started:
                if server is not None:
                    try:
                        server.close()
                    except Exception:
                        pass
                raise RuntimeError(
                    f"SMTP send was rejected or could not be confirmed: {smtp_err}"
                ) from smtp_err
            errors.append(f"port {port}: {smtp_err}")
=======
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
            # Enhanced error logging for diagnostics
            error_msg = str(smtp_err)
            if isinstance(smtp_err, OSError):
                errno = getattr(smtp_err, 'errno', getattr(smtp_err, 'winerror', None))
                if errno in WINSOCK_ERRORS:
                    error_msg += f" [{WINSOCK_ERRORS[errno]}]"

            errors.append(f"port {port}: {error_msg}")
>>>>>>> main
            if server is not None:
                try:
                    server.close()
                except Exception:
                    pass
    error_message = "; ".join(errors)
    logger.error(f"All SMTP transport attempts failed for recipient {to_email}: {error_message}")
    with open(log_path, "a") as lf:
        lf.write(f"SMTP Error: {error_message}\n")
        lf.write(f"System: {platform.system()} | Host: {settings.email_host}:{settings.email_port}\n")
    raise RuntimeError(error_message)

<<<<<<< HEAD
async def send_email(to_email: str, subject: str, body: str, html_body: str | None = None, attachments: list[tuple[str, bytes, str]] | None = None):
=======
async def send_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
    attachments: Iterable[tuple[str, bytes, str]] = (),
):
>>>>>>> main
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
        logger.info(f"Sending email to {to_email} via {settings.email_host}:{settings.email_port}")
        if html_body is None:
            html_body = render_premium_email(
                eyebrow="Notification",
                title=subject,
                greeting="Hello,",
                intro=body,
            )
<<<<<<< HEAD

        logger.info(f"send_email initiated for recipient={to_email}, subject={subject}")
        await anyio.to_thread.run_sync(_send_sync, to_email, subject, body, html_body, attachments)
        logger.info(f"send_email completed successfully for recipient={to_email}")
        return True
    except Exception as e:
        logger.error(f"send_email failed for recipient={to_email}: {e}")
=======
        # Run synchronous smtplib in a separate thread
        await anyio.to_thread.run_sync(_send_sync, to_email, subject, body, html_body, tuple(attachments))
        logger.info(f"Email sent successfully to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Email failed to {to_email}: {type(e).__name__}: {e}")
>>>>>>> main
        raise
