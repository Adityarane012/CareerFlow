import os
import time
import socket
import smtplib
import imaplib
import logging
from email.message import EmailMessage

# Module-level logger
logger = logging.getLogger("the_closer.email_sender")

# Draft folder fallback chain per edge-case spec
DRAFT_FOLDERS = ["[Gmail]/Drafts", "Drafts", "Draft", "INBOX.Drafts"]


def _build_mime(sender_name, smtp_user, recipient_email, subject, body):
    """Constructs a plain-text MIME EmailMessage object."""
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{sender_name} <{smtp_user}>" if sender_name else smtp_user
    msg["To"] = recipient_email
    msg.set_content(body)
    return msg


def send_email_smtp(recipient_email, subject, body, sender_name=""):
    """
    Sends an email via SMTP with STARTTLS (port 587).

    Returns a tuple: (status, error_message)
      - ("dry_run", None)   — DRY_RUN=true is set; no socket opened
      - ("sent",    None)   — email dispatched successfully
      - ("failed",  str)    — a specific error occurred

    Edge cases handled:
      - DRY_RUN=true       → returns immediately, no TCP connection
      - Invalid SMTP_PORT  → ValueError caught at parse; returns ("failed", "Invalid SMTP_PORT value")
      - Missing creds      → pre-checked before connect; returns ("failed", "Missing credentials")
      - Bad credentials    → SMTPAuthenticationError caught; returns descriptive message
      - Port blocked/timeout → socket.timeout caught; returns descriptive message
      - Any other failure  → generic SMTPException / Exception caught
    """
    # ── Dry-run gate ──────────────────────────────────────────────────
    dry_run = os.getenv("DRY_RUN", "true").lower() == "true"
    if dry_run:
        logger.info(f"[DRY RUN] Simulated SMTP send to {recipient_email}")
        return "dry_run", None

    # ── Credential & config validation ────────────────────────────────
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")

    try:
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError:
        logger.error("Invalid SMTP_PORT value in .env — must be an integer.")
        return "failed", "Invalid SMTP_PORT value"

    if not smtp_user or not smtp_pass:
        logger.error("SMTP_USER or SMTP_PASSWORD missing from environment.")
        return "failed", "Missing credentials"

    # ── SMTP dispatch ─────────────────────────────────────────────────
    try:
        msg = _build_mime(sender_name, smtp_user, recipient_email, subject, body)

        logger.info(f"Connecting to SMTP {smtp_host}:{smtp_port} ...")
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
        server.ehlo()

        if smtp_port == 587:
            server.starttls()   # Upgrade plain connection to TLS
            server.ehlo()

        logger.info(f"Authenticating as {smtp_user} ...")
        server.login(smtp_user, smtp_pass)

        logger.info(f"Sending to {recipient_email} ...")
        server.send_message(msg)
        server.quit()

        logger.info(f"Email sent successfully to {recipient_email}")
        return "sent", None

    except smtplib.SMTPAuthenticationError as e:
        # Wrong password / App Password not enabled
        logger.error(f"SMTP authentication failed for {smtp_user}: {e}")
        return "failed", f"SMTPAuthenticationError: {e}"

    except socket.timeout:
        # Port 587 blocked by ISP or firewall
        logger.error(f"SMTP connection to {smtp_host}:{smtp_port} timed out.")
        return "failed", f"Connection timed out — port {smtp_port} may be blocked by your ISP or firewall"

    except smtplib.SMTPException as e:
        logger.error(f"SMTP protocol error: {e}")
        return "failed", f"SMTPException: {e}"

    except OSError as e:
        logger.error(f"Network/OS error during SMTP: {e}")
        return "failed", f"Network error: {e}"


def save_draft_imap(recipient_email, subject, body, sender_name=""):
    """
    Saves an email as a draft via IMAP4_SSL (port 993).

    Returns a tuple: (status, error_message)
      - ("dry_run",  None) — DRY_RUN=true is set; no socket opened
      - ("drafted",  None) — draft appended to mailbox successfully
      - ("failed",   str)  — a specific error occurred

    Edge cases handled:
      - DRY_RUN=true       → returns immediately, no TCP connection
      - Invalid IMAP_PORT  → ValueError caught at parse; returns ("failed", "Invalid IMAP_PORT value")
      - Missing creds      → pre-checked before connect; returns ("failed", "Missing credentials")
      - Bad credentials    → IMAP4.error caught; returns descriptive message
      - Draft folder missing → tries [Gmail]/Drafts → Drafts → Draft → INBOX.Drafts sequentially
      - All folders exhausted → returns ("failed", "Draft folders exhausted. Last error: ...")
    """
    # ── Dry-run gate ──────────────────────────────────────────────────
    dry_run = os.getenv("DRY_RUN", "true").lower() == "true"
    if dry_run:
        logger.info(f"[DRY RUN] Simulated IMAP draft save for {recipient_email}")
        return "dry_run", None

    # ── Credential & config validation ────────────────────────────────
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
    imap_user = (os.getenv("IMAP_USER") or smtp_user).strip()
    imap_pass = (os.getenv("IMAP_PASSWORD") or smtp_pass).strip()
    imap_host = os.getenv("IMAP_HOST", "imap.gmail.com")

    try:
        imap_port = int(os.getenv("IMAP_PORT", "993"))
    except ValueError:
        logger.error("Invalid IMAP_PORT value in .env — must be an integer.")
        return "failed", "Invalid IMAP_PORT value"

    if not imap_user or not imap_pass:
        logger.error("IMAP credentials are missing — set SMTP_USER/SMTP_PASSWORD or IMAP_USER/IMAP_PASSWORD.")
        return "failed", "Missing credentials"

    # ── IMAP draft append ─────────────────────────────────────────────
    try:
        msg = _build_mime(sender_name, imap_user, recipient_email, subject, body)
        raw_msg = msg.as_bytes()

        logger.info(f"Connecting to IMAP {imap_host}:{imap_port} ...")
        if imap_port == 993:
            mail = imaplib.IMAP4_SSL(imap_host, imap_port)
        else:
            mail = imaplib.IMAP4(imap_host, imap_port)

        logger.info(f"Authenticating as {imap_user} ...")
        mail.login(imap_user, imap_pass)

        # ── Draft folder fallback chain ───────────────────────────────
        appended = False
        last_err = ""

        for folder in DRAFT_FOLDERS:
            try:
                status, _ = mail.append(
                    folder,
                    "(\\Draft)",
                    imaplib.Time2Internaldate(time.time()),
                    raw_msg,
                )
                if status == "OK":
                    appended = True
                    logger.info(f"Draft saved to IMAP folder '{folder}' for {recipient_email}")
                    break
            except imaplib.IMAP4.error as folder_err:
                last_err = str(folder_err)
                logger.debug(f"Folder '{folder}' unavailable: {folder_err}")
                continue

        try:
            mail.logout()
        except Exception:
            pass

        if appended:
            return "drafted", None

        logger.error(f"All IMAP draft folders exhausted for {recipient_email}. Last error: {last_err}")
        return "failed", f"Draft folders exhausted. Last error: {last_err}"

    except imaplib.IMAP4.error as e:
        # Authentication failure or protocol-level error
        logger.error(f"IMAP error for {imap_user}: {e}")
        return "failed", f"IMAP4.error: {e}"

    except socket.timeout:
        logger.error(f"IMAP connection to {imap_host}:{imap_port} timed out.")
        return "failed", f"Connection timed out — port {imap_port} may be blocked"

    except OSError as e:
        logger.error(f"Network/OS error during IMAP: {e}")
        return "failed", f"Network error: {e}"
