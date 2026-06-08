# Implementation Plan - The Closer (Cold Email Writer + Send Bot)

This plan outlines the phase-wise development lifecycle to build **The Closer**, a command-line cold email bot. It is cross-referenced with [`architecture.md`](./architecture.md) (system design & data flow) and [`edge-case.md`](./edge-case.md) (failure modes & mitigations).

---

## Key Architectural Decisions (from architecture.md)

> [!IMPORTANT]
> - The system follows a **modular, pipeline-oriented architecture**: `contacts.json` → `main.py` → `email_generator.py` → `email_sender.py` → `logger.py`
> - By default, the application runs in `DRY_RUN=true` mode. No emails are sent or drafted until explicitly configured.
> - Draft creation uses Python's built-in `imaplib` to append drafts to `[Gmail]/Drafts`, falling back through `Drafts`, `Draft`, and `INBOX.Drafts` folder names before failing.
> - Optional Groq LLM rewriting via the `groq` package is triggered only when `GROQ_API_KEY` is present. The system gracefully falls back to deterministic templates on any API failure.
> - Credentials are never hardcoded — all secrets flow through a `.env` file using `python-dotenv`.

---

## Phase-wise Implementation Steps

### Phase 1: Base Configuration & Inputs
**Architecture Reference**: Data Layer — `contacts.json` and `.env` Configuration  
**Edge Cases Covered**:
- Missing `.env` file → app exits with code `1` and descriptive message
- Malformed `contacts.json` → `json.JSONDecodeError` caught, parser warning printed, app exits cleanly
- Empty contacts list `[]` → system prints "0 targets loaded" and exits without entering loop
- Missing optional fields (`portfolio_url`, `personalization_note`) → generator skips or uses placeholders
- Special characters in fields → UTF-8 encoding enforced on file reads

#### [NEW] [contacts.json](../../../apps/web/contacts.json)
- Stores structured job list with all required fields: `recipient_email`, `company`, `role`, `candidate_name`, `candidate_background`.
- Optional fields: `recipient_name`, `job_url`, `personalization_note`, `portfolio_url`.
- Must contain at least 3 valid records.

#### [NEW] [requirements.txt](../../../apps/web/requirements.txt)
- Specifies: `python-dotenv>=1.0.0`, `groq>=0.4.0`.

#### [NEW] [.env.example](../../../apps/web/.env.example)
- Template covering: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `IMAP_HOST`, `IMAP_PORT`, `SENDER_NAME`, `DRY_RUN`, `GROQ_API_KEY`, `GROQ_MODEL`.

**Phase 1 Test Runner**: `test_phase1.py`
- Verifies all required files exist.
- Validates contact schema (required fields present for each record).
- Confirms `.env` loads and `DRY_RUN` is set.

---

### Phase 2: Email Generator Subsystem
**Architecture Reference**: Subsystem B — Email Generation Subsystem (`email_generator.py`)  
**Edge Cases Covered**:
- Groq API down/offline → `Exception` caught, warning logged, falls back to deterministic template
- Groq API quota exceeded → Same fallback mechanism via exception handling
- Extremely long personalization note → Groq mode applies 150-word prompt constraints to compress; template mode inserts as-is
- No personalization hook provided → Default generic hook used: `"I noticed that {company} is hiring for the {role} role."`

#### [NEW] [email_generator.py](../../../apps/web/email_generator.py)
- `generate_email(contact_record)`: Entry point. Checks for `GROQ_API_KEY` env variable.
  - If present → calls Groq API (`llama-3.3-70b-versatile`) with `response_format={"type": "json_object"}` to return structured `{subject, body}`.
  - If absent or API fails → falls back to `generate_deterministic_email()`.
- `generate_deterministic_email(contact_record)`: Populates the structured 6-part email template:
  1. Subject line (role + company)
  2. Personalization hook (from `personalization_note`)
  3. Candidate introduction (`candidate_name` + `candidate_background`)
  4. Value/fit statement
  5. Single CTA (10-minute chat or referral request)
  6. Sign-off with `portfolio_url` if present
- All generated emails must be **under 150 words** and contain **exactly one CTA**.

**Phase 2 Test Runner**: `test_phase2.py`
- Tests deterministic template: validates role/company/name interpolation and word count < 150.
- Tests Groq generator (if key present): validates non-empty output and word count < 150.
- Tests fallback: with invalid key, confirms deterministic template is used.

---

### Phase 3: Logging Infrastructure
**Architecture Reference**: Subsystem D — Logging Subsystem (`logger.py`)  
**Edge Cases Covered**:
- Log file locked/read-only → `PermissionError` caught, terminal warning printed, loop continues
- CSV injection → Python's `csv` library handles escaping of formula characters (`=`, `+`, `-`, `@`)
- Concurrent writes → Standard file append mode used, safe for sequential operations

#### [NEW] [logger.py](../../../apps/web/logger.py)
- `log_outreach(recipient_email, company, role, subject, status, error_message)`: Appends to `outreach_log.csv`.
- Creates file with headers on first run, appends thereafter.
- Logged fields: `timestamp` (ISO format), `recipient_email`, `company`, `role`, `subject`, `status`, `error_message`.
- Valid status codes: `dry_run`, `sent`, `drafted`, `skipped`, `failed`.

**Phase 3 Test Runner**: `test_phase3.py`
- Verifies CSV headers match spec exactly.
- Verifies file creation on first call, append on subsequent calls.
- Verifies comma-in-subject does not break column alignment.

---

### Phase 4: Delivery Subsystem (SMTP & IMAP Agents)
**Architecture Reference**: Subsystem C — Email Sender Subsystem (`email_sender.py`)  
**Edge Cases Covered**:
- `DRY_RUN=true` → No TCP socket is opened; simulated status returned immediately
- Invalid SMTP/IMAP credentials → `SMTPAuthenticationError` or `IMAP4.error` caught; returns `("failed", error_string)`
- Port 587 blocked by ISP → Socket timeout caught; descriptive error returned (not crash)
- Missing IMAP draft folder → Tries `[Gmail]/Drafts` → `Drafts` → `Draft` → `INBOX.Drafts` sequentially; logs exhausted error if all fail
- Missing `SMTP_USER`/`SMTP_PASSWORD` in live mode → Detected before connection attempt; returns `("failed", "Missing credentials")`
- Invalid `SMTP_PORT` or `IMAP_PORT` value → `ValueError` caught at parse time; descriptive error returned

#### [NEW] [email_sender.py](../../../apps/web/email_sender.py)
- `send_email_smtp(recipient_email, subject, body, sender_name)`:
  - Builds MIME `EmailMessage`, connects via SMTP on port 587 with STARTTLS upgrade.
  - Returns `("sent", None)` on success, `("dry_run", None)` in dry-run mode, or `("failed", error)`.
- `save_draft_imap(recipient_email, subject, body, sender_name)`:
  - Connects via IMAP4_SSL on port 993.
  - Appends raw MIME bytes with `\Draft` flag using `mail.append()`.
  - Falls back through multiple draft folder names.
  - Returns `("drafted", None)` on success.

**Phase 4 Test Runner**: `test_phase4.py`
- Verifies `send_email_smtp` returns `("dry_run", None)` when `DRY_RUN=true`.
- Verifies `save_draft_imap` returns `("dry_run", None)` when `DRY_RUN=true`.
- Verifies credential-missing check returns `("failed", "Missing credentials")`.

---

### Phase 5: CLI Orchestrator Engine
**Architecture Reference**: Subsystem E — CLI Orchestration (`main.py`) + full data flow lifecycle  
**Edge Cases Covered**:
- `SMTP_USER` not configured in live mode → Detected before loop starts; exits with error
- Invalid CLI input (not `s`/`d`/`k`/`q`) → Input loop retries with error message; does not crash
- User presses `Ctrl+C` → `KeyboardInterrupt` caught gracefully; exits cleanly
- Windows terminal ANSI color codes → `SetConsoleMode` via `ctypes` attempted; silently falls back to no-color mode if it fails

#### [NEW] [main.py](../../../apps/web/main.py)
- `load_dotenv()` → reads all config from `.env`.
- `load_contacts("contacts.json")` → exits with error if file missing or JSON malformed.
- `print_banner(dry_run)` → displays mode clearly.
- Per-contact loop:
  1. `generate_email(contact)` → personalized subject + body.
  2. Print preview to terminal.
  3. Input prompt (`s` / `d` / `k` / `q`) with retry on invalid input.
  4. Dispatch to `send_email_smtp()` or `save_draft_imap()`.
  5. `log_outreach()` → append result to CSV.
- Dual logging: internal `app.log` (via Python `logging`) + `outreach_log.csv`.

#### [NEW] [README.md](../../../apps/web/README.md)
- Setup instructions, Gmail App Password guide, security warnings, run commands.

**Phase 5 Test Runner**: `python main.py` (interactive) with `DRY_RUN=true`.
- Confirm preview renders for all 3 contacts.
- Walk through all 4 input options (send, draft, skip, quit).
- Confirm `outreach_log.csv` is written correctly.

---

## Full Verification Plan

### Automated Phase Tests
```bash
python test_phase1.py    # Config & data validation
python test_phase2.py    # Email generator (template + Groq)
python test_phase3.py    # Logger CSV integrity
python test_phase4.py    # SMTP/IMAP dry-run safety
```

### End-to-End CLI Test
```bash
DRY_RUN=true python main.py    # Full interactive walkthrough
```

### Live Integration Test (optional)
- Set `DRY_RUN=false` in `.env`, configure real Gmail App Password.
- Run `python main.py` and send a test email to your own address first.
- Verify email appears in Gmail Sent/Drafts folder.
