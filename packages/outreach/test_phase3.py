"""
Phase 3 Verification Runner — Logging Infrastructure
Checks as per implementation_plan.md:
  1. CSV headers match spec exactly.
  2. File created on first call, appended on subsequent calls.
  3. Comma-in-subject does not break column alignment.
"""

import os
import csv
import sys

# Use a temporary test log file so we never corrupt the real one
TEST_LOG_FILE = "test_outreach_log.csv"

EXPECTED_HEADERS = [
    "timestamp",
    "recipient_email",
    "company",
    "role",
    "subject",
    "status",
    "error_message",
]

EXPECTED_STATUSES = {"dry_run", "sent", "drafted", "skipped", "failed"}


def cleanup():
    """Remove the test CSV file before and after each run."""
    if os.path.exists(TEST_LOG_FILE):
        os.remove(TEST_LOG_FILE)


def run_log(recipient_email, company, role, subject, status, error_message=""):
    """
    Calls logger.log_outreach but redirects LOG_FILE to the test file.
    Temporarily patches the module-level constant.
    """
    import logger as log_module
    original = log_module.LOG_FILE
    log_module.LOG_FILE = TEST_LOG_FILE
    try:
        log_module.log_outreach(recipient_email, company, role, subject, status, error_message)
    finally:
        log_module.LOG_FILE = original


def read_csv_rows():
    with open(TEST_LOG_FILE, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        return list(reader)


def test_phase3():
    print("=" * 55)
    print("   PHASE 3 VERIFICATION RUNNER — Logging Infrastructure")
    print("=" * 55)

    passed = 0
    failed = 0

    # ── CHECK 1: File creation + header correctness ──────────────────
    print("\n[CHECK 1] CSV headers match spec exactly & file created on first call...")
    cleanup()
    run_log(
        recipient_email="priya@example.com",
        company="Acme AI",
        role="Backend Engineering Intern",
        subject="Outreach: Backend Engineering Intern opportunity at Acme AI",
        status="dry_run",
    )

    if not os.path.exists(TEST_LOG_FILE):
        print("[FAIL] outreach_log.csv was not created on first call.")
        failed += 1
    else:
        rows = read_csv_rows()
        actual_headers = rows[0]
        if actual_headers == EXPECTED_HEADERS:
            print(f"[PASS] Headers match spec: {actual_headers}")
            passed += 1
        else:
            print(f"[FAIL] Header mismatch.\n  Expected: {EXPECTED_HEADERS}\n  Got:      {actual_headers}")
            failed += 1

    # ── CHECK 2: Append on subsequent calls (row count grows) ────────
    print("\n[CHECK 2] File appends on subsequent calls (no header duplication)...")
    run_log(
        recipient_email="david.miller@techflow.io",
        company="TechFlow Systems",
        role="Software Engineer (Python/Django)",
        subject="Optimizing Django App Performance",
        status="sent",
    )
    run_log(
        recipient_email="ananya.r@cloudscale.net",
        company="CloudScale Solutions",
        role="Cloud Automation Engineer",
        subject="Outreach: Cloud Automation Engineer at CloudScale",
        status="drafted",
    )

    rows = read_csv_rows()
    # Expect: 1 header row + 3 data rows = 4 total
    if len(rows) == 4:
        print(f"[PASS] File has {len(rows)} rows (1 header + 3 data). No duplicate headers.")
        passed += 1
    else:
        print(f"[FAIL] Expected 4 rows (1 header + 3 data), got {len(rows)}.")
        failed += 1

    # ── CHECK 3: Comma-in-subject does not break column alignment ────
    print("\n[CHECK 3] Comma in subject does not break CSV column alignment...")
    cleanup()
    tricky_subject = "Hi, this is a subject with, multiple, commas"
    run_log(
        recipient_email="test@test.com",
        company="TestCo",
        role="Tester",
        subject=tricky_subject,
        status="skipped",
        error_message="",
    )

    rows = read_csv_rows()
    # rows[0] = headers, rows[1] = data
    if len(rows) != 2:
        print(f"[FAIL] Expected 2 rows (header + 1 data). Got {len(rows)}.")
        failed += 1
    else:
        data_row = rows[1]
        if len(data_row) == len(EXPECTED_HEADERS):
            recovered_subject = data_row[4]  # subject is column index 4
            if recovered_subject == tricky_subject:
                print(f"[PASS] Column count correct ({len(data_row)} cols). Subject with commas parsed intact.")
                passed += 1
            else:
                print(f"[FAIL] Subject recovered incorrectly.\n  Expected: '{tricky_subject}'\n  Got:      '{recovered_subject}'")
                failed += 1
        else:
            print(f"[FAIL] Column count wrong: expected {len(EXPECTED_HEADERS)}, got {len(data_row)}.")
            failed += 1

    # ── CHECK 4: ISO 8601 timestamp format ───────────────────────────
    print("\n[CHECK 4] Timestamp is in ISO 8601 format (UTC)...")
    cleanup()
    run_log("ts@check.com", "TSCo", "Tester", "TS Subject", "failed", "timeout")
    rows = read_csv_rows()
    ts = rows[1][0]  # timestamp is column 0
    try:
        from datetime import datetime, timezone
        # isoformat with timezone info: 2026-06-02T07:21:19+00:00
        parsed = datetime.fromisoformat(ts)
        if parsed.tzinfo is not None:
            print(f"[PASS] Timestamp is valid ISO 8601 with timezone: {ts}")
            passed += 1
        else:
            print(f"[FAIL] Timestamp parsed but has no timezone info: {ts}")
            failed += 1
    except ValueError:
        print(f"[FAIL] Timestamp is not valid ISO 8601 format: '{ts}'")
        failed += 1

    # ── CHECK 5: error_message field is logged correctly ─────────────
    print("\n[CHECK 5] Error message is captured correctly in the log row...")
    cleanup()
    run_log("err@test.com", "ErrCo", "Engineer", "Error Test Subject", "failed", "SMTPAuthenticationError: [534] credentials rejected")
    rows = read_csv_rows()
    error_field = rows[1][6]  # error_message is column index 6
    if "SMTPAuthenticationError" in error_field:
        print(f"[PASS] Error message logged correctly: '{error_field}'")
        passed += 1
    else:
        print(f"[FAIL] Error message not captured. Got: '{error_field}'")
        failed += 1

    # ── CLEANUP ──────────────────────────────────────────────────────
    cleanup()

    # ── SUMMARY ──────────────────────────────────────────────────────
    print("\n" + "=" * 55)
    print(f"PHASE 3 RESULTS: {passed} passed, {failed} failed")
    if failed == 0:
        print("PHASE 3 EVALUATION STATUS: ALL PASSED [OK]")
    else:
        print("PHASE 3 EVALUATION STATUS: SOME CHECKS FAILED [FAIL]")
        sys.exit(1)
    print("=" * 55)


if __name__ == "__main__":
    test_phase3()
