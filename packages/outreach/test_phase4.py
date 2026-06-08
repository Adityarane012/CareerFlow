"""
Phase 4 Verification Runner — Delivery Subsystem (SMTP & IMAP)
Checks as per implementation_plan.md:
  1. send_email_smtp returns ("dry_run", None) when DRY_RUN=true.
  2. save_draft_imap returns ("dry_run", None) when DRY_RUN=true.
  3. Credential-missing check returns ("failed", "Missing credentials").
  4. Invalid SMTP_PORT returns ("failed", "Invalid SMTP_PORT value").
  5. Invalid IMAP_PORT returns ("failed", "Invalid IMAP_PORT value").

All tests run with DRY_RUN=true and/or patched env vars — no real TCP connections are made.
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

# ─── Patch helpers ────────────────────────────────────────────────────────────

def patch_env(**kwargs):
    """Context manager to temporarily set env vars and restore them afterwards."""
    originals = {k: os.environ.get(k) for k in kwargs}

    class _Ctx:
        def __enter__(self):
            for k, v in kwargs.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
            return self

        def __exit__(self, *_):
            for k, orig in originals.items():
                if orig is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = orig

    return _Ctx()


# ─── Test runner ──────────────────────────────────────────────────────────────

def test_phase4():
    from email_sender import send_email_smtp, save_draft_imap

    print("=" * 58)
    print("   PHASE 4 VERIFICATION RUNNER — Delivery Subsystem")
    print("=" * 58)

    passed = 0
    failed = 0

    # Shared dummy values used across tests
    DUMMY = dict(
        recipient_email="test@example.com",
        subject="Test Subject",
        body="This is a test email body for Phase 4 verification.",
        sender_name="Test Sender",
    )

    # ── CHECK 1: SMTP dry-run gate ─────────────────────────────────────
    print("\n[CHECK 1] send_email_smtp returns ('dry_run', None) when DRY_RUN=true ...")
    with patch_env(DRY_RUN="true"):
        result = send_email_smtp(**DUMMY)
    if result == ("dry_run", None):
        print(f"[PASS] send_email_smtp dry_run returned: {result}")
        passed += 1
    else:
        print(f"[FAIL] Expected ('dry_run', None), got: {result}")
        failed += 1

    # ── CHECK 2: IMAP dry-run gate ─────────────────────────────────────
    print("\n[CHECK 2] save_draft_imap returns ('dry_run', None) when DRY_RUN=true ...")
    with patch_env(DRY_RUN="true"):
        result = save_draft_imap(**DUMMY)
    if result == ("dry_run", None):
        print(f"[PASS] save_draft_imap dry_run returned: {result}")
        passed += 1
    else:
        print(f"[FAIL] Expected ('dry_run', None), got: {result}")
        failed += 1

    # ── CHECK 3: Missing SMTP credentials detected pre-connect ─────────
    print("\n[CHECK 3] send_email_smtp returns ('failed', 'Missing credentials') when creds absent ...")
    with patch_env(DRY_RUN="false", SMTP_USER=None, SMTP_PASSWORD=None):
        result = send_email_smtp(**DUMMY)
    status, err = result
    if status == "failed" and err == "Missing credentials":
        print(f"[PASS] Missing-credential check returned: {result}")
        passed += 1
    else:
        print(f"[FAIL] Expected ('failed', 'Missing credentials'), got: {result}")
        failed += 1

    # ── CHECK 4: Missing IMAP credentials detected pre-connect ─────────
    print("\n[CHECK 4] save_draft_imap returns ('failed', 'Missing credentials') when creds absent ...")
    with patch_env(DRY_RUN="false", SMTP_USER=None, SMTP_PASSWORD=None,
                   IMAP_USER=None, IMAP_PASSWORD=None):
        result = save_draft_imap(**DUMMY)
    status, err = result
    if status == "failed" and err == "Missing credentials":
        print(f"[PASS] Missing-credential check returned: {result}")
        passed += 1
    else:
        print(f"[FAIL] Expected ('failed', 'Missing credentials'), got: {result}")
        failed += 1

    # ── CHECK 5: Invalid SMTP_PORT value ───────────────────────────────
    print("\n[CHECK 5] send_email_smtp returns ('failed', 'Invalid SMTP_PORT value') on bad port ...")
    with patch_env(DRY_RUN="false", SMTP_USER="u@example.com", SMTP_PASSWORD="pass", SMTP_PORT="not_a_number"):
        result = send_email_smtp(**DUMMY)
    status, err = result
    if status == "failed" and "Invalid SMTP_PORT" in str(err):
        print(f"[PASS] Invalid port check returned: {result}")
        passed += 1
    else:
        print(f"[FAIL] Expected ('failed', 'Invalid SMTP_PORT value'), got: {result}")
        failed += 1

    # ── CHECK 6: Invalid IMAP_PORT value ───────────────────────────────
    print("\n[CHECK 6] save_draft_imap returns ('failed', 'Invalid IMAP_PORT value') on bad port ...")
    with patch_env(DRY_RUN="false", SMTP_USER="u@example.com", SMTP_PASSWORD="pass", IMAP_PORT="not_a_number"):
        result = save_draft_imap(**DUMMY)
    status, err = result
    if status == "failed" and "Invalid IMAP_PORT" in str(err):
        print(f"[PASS] Invalid port check returned: {result}")
        passed += 1
    else:
        print(f"[FAIL] Expected ('failed', 'Invalid IMAP_PORT value'), got: {result}")
        failed += 1

    # ── SUMMARY ───────────────────────────────────────────────────────
    print("\n" + "=" * 58)
    print(f"PHASE 4 RESULTS: {passed} passed, {failed} failed")
    if failed == 0:
        print("PHASE 4 EVALUATION STATUS: ALL PASSED [OK]")
    else:
        print("PHASE 4 EVALUATION STATUS: SOME CHECKS FAILED [FAIL]")
        sys.exit(1)
    print("=" * 58)


if __name__ == "__main__":
    test_phase4()
