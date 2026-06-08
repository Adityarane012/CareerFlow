import os
import csv
import logging
from datetime import datetime, timezone

# Module-level logger for diagnostics
_log = logging.getLogger("the_closer.logger")

# The log file name as defined in the requirements
LOG_FILE = "outreach_log.csv"

# Valid status codes per the implementation plan
VALID_STATUSES = {"dry_run", "sent", "drafted", "skipped", "failed"}

# CSV column headers — order matters, must match spec exactly
HEADERS = [
    "timestamp",
    "recipient_email",
    "company",
    "role",
    "subject",
    "status",
    "error_message",
]


def log_outreach(recipient_email, company, role, subject, status, error_message=""):
    """
    Logs the outcome of an email outreach task into outreach_log.csv.

    - Creates the CSV with headers on first run.
    - Appends one row per call thereafter.
    - Uses ISO 8601 timestamp (UTC).
    - Catches PermissionError separately so the orchestration loop can continue.
    - Uses Python's csv module, which safely escapes commas and CSV injection chars.

    Args:
        recipient_email (str): Target email address.
        company        (str): Company name.
        role           (str): Job role title.
        subject        (str): Email subject line.
        status         (str): One of 'dry_run', 'sent', 'drafted', 'skipped', 'failed'.
        error_message  (str): Optional error detail; empty string if none.
    """
    if status not in VALID_STATUSES:
        _log.warning(f"Unexpected status code '{status}' logged for {recipient_email}.")

    # ISO 8601 timestamp in UTC (e.g. 2026-06-02T07:21:19+00:00)
    timestamp = datetime.now(tz=timezone.utc).isoformat()

    # Sanitise inputs — ensure they are strings
    row = [
        timestamp,
        str(recipient_email) if recipient_email else "",
        str(company)         if company         else "",
        str(role)            if role             else "",
        str(subject)         if subject          else "",
        str(status)          if status           else "",
        str(error_message)   if error_message    else "",
    ]

    file_exists = os.path.exists(LOG_FILE)

    try:
        with open(LOG_FILE, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(HEADERS)  # Write headers on first create
            writer.writerow(row)

        _log.info(f"Logged [{status}] for {recipient_email} @ {company}")

    except PermissionError as e:
        # Edge case: log file is locked or read-only — warn and continue, do NOT crash
        print(f"[WARNING] Cannot write to '{LOG_FILE}' — file is locked or read-only: {e}")
        _log.warning(f"PermissionError writing to log file: {e}")

    except OSError as e:
        # Other OS-level I/O errors (disk full, bad path, etc.)
        print(f"[WARNING] OS error while writing to '{LOG_FILE}': {e}")
        _log.warning(f"OSError writing to log file: {e}")
