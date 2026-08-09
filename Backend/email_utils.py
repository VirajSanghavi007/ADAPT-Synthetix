"""Minimal transactional email sender via SMTP. Separate from Supabase Auth's own
emails (confirm/reset/magiclink) since those only cover auth-flow templates —
account-deletion confirmation is a custom email Supabase doesn't send for us.

If SMTP_HOST isn't configured, send_email() returns False and logs instead of
raising, so callers can fall back to returning the link directly (dev-only).
"""
import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)

SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "no-reply@adapt-synthetix.app")


def send_email(to: str, subject: str, body: str) -> bool:
    if not SMTP_HOST:
        logger.warning("SMTP not configured; would have sent to %s: %s\n%s", to, subject, body)
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = FROM_EMAIL
    msg["To"] = to
    msg.set_content(body)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        if SMTP_USER and SMTP_PASSWORD:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
    return True
