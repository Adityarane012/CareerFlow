# 🛡️ Quality Assurance: Edge Cases & Mitigations Matrix

This document outlines the edge-case profiles, failure modes, validation results, and mitigation handlers for the **CareerFlow Platform** across all 5 implementation phases.

---

## Phase 1: Bootstrap & Monorepo Setup

### 1.1. Edge Cases & Mitigations

| Edge Case | Description | Severity | Platform Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Missing Encryption Secret** | `ENCRYPTION_SECRET` variable is missing or empty in environment. | High | Raise a configuration error on startup to prevent writing credentials with a vulnerable fallback key. |
| **Unique Email Collision** | Candidate registers with an email that already exists in the system. | Medium | API performs an `UPSERT` operation—updating existing profile and credentials instead of throwing a database unique key constraint error. |
| **Malformed Database Path** | SQLite DB path points to a write-protected folder or database lock contention. | Medium | Connect arguments set `check_same_thread=False` and apply connection timeouts (15s) to prevent lock freezes during parallel thread accesses. |

### 1.2. Verification & Testing Log
* **Run Date**: 2026-06-08
* **Status**: `[x] Passed`
* **Test Commands**:
  ```bash
  pytest apps/server/tests/test_security.py
  ```
* **Observed Output**:
  ```
  ============================= test session starts =============================
  platform win32 -- Python 3.13.2, pytest-9.0.3, pluggy-1.6.0
  collected 2 items

  apps\server\tests\test_security.py ..                                    [100%]

  ============================== 2 passed in 0.12s ==============================
  ```

---

## Phase 2: Discovery Engine Integration

### 2.1. Edge Cases & Mitigations

| Edge Case | Description | Severity | Platform Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Unicode Mojibake Corruption** | Double-encoded characters from scraped platforms (e.g. Naukri) render as corrupted raw strings (e.g. `â€™` instead of `'`). | Low | CP1252 byte-mapping re-encoder restores zeroes-width emojis and symbols to raw bytes, re-decoding them as valid UTF-8. |
| **Truncated Open HTML Tags** | Response data contains incomplete HTML strings like `<span class="` or `<stron` due to scraping buffers cutting off. | Medium | Text cleaner uses a lookahead regex (`<[a-zA-Z]+[^>\n]*?(?=\n|$)`) to strip incomplete tags while preserving normal math signs like `< 2 years`. |
| **Platform Rate-Limiting / Block** | Naukri blocks scraping requests, returning HTTP 403 or Cloudflare captcha. | High | Sidecar controller rotates User-Agent strings, injects delay intervals, and returns a partial success response listing RemoteOK and Wellfound results without failing the entire scrape run. |
| **Deduplication Key Collision** | Identical jobs scraped under different platform-specific IDs. | Low | Database unique constraint `unique_job_key` on `(title, company, platform, location)` drops duplicates on conflict. |

### 2.2. Verification & Testing Log
* **Run Date**: 2026-06-08
* **Status**: `[x] Passed`
* **Test Commands**:
  ```bash
  pytest apps/server/tests/test_scrapers_and_tailoring.py -k test_trigger_scrape_endpoint
  ```
* **Observed Output**:
  ```
  apps/server/tests/test_scrapers_and_tailoring.py .                       [100%]
  ======================= 1 passed, 4 deselected in 1.25s =======================
  ```

---

## Phase 3: Resume Tailoring Workspace

### 3.1. Edge Cases & Mitigations

| Edge Case | Description | Severity | Platform Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Corrupted Document Ingestion** | Candidate uploads a password-protected, empty, or corrupted PDF/DOCX file. | High | Zod schema validation blocks the upload, catching parsing errors early and returning a clean frontend banner message. |
| **LLM Experience Fabrication** | LLM invents past jobs, titles, or certifications to increase the ATS matching score. | Critical | Prompt limits force the LLM within a strict context boundary (Candidate Profile only). If the LLM generates words not present in the base profile, the system flags the items with a warning icon (`⚠ Risk Flag`). |
| **Token Limit Mismatch** | A massive resume or JD exceeds LLM token limits. | High | Ingestion service uses token summarizers to condense secondary resume fields, and applies the Double-Fail-Safe Merge algorithm to prevent truncation of core job experiences. |
| **Serverless Puppeteer Crash** | Vercel Serverless timeout (15s) or 50MB function package size boundary exceeded by Chromium dependencies. | High | Load `@sparticuz/chromium` dynamically at runtime in production, completely bypassing Vercel package limitations. |

### 3.2. Verification & Testing Log
* **Run Date**: 2026-06-08
* **Status**: `[x] Passed`
* **Test Commands**:
  ```bash
  npx tsc --noEmit
  pytest apps/server/tests/ -k test_shortlist_and_tailor_flow
  ```
* **Observed Output**:
  ```
  npx tsc --noEmit -> Success (exit 0)
  test_shortlist_and_tailor_flow -> Passed (1 passed)
  ```

---

## Phase 4: Outreach Console

### 4.1. Edge Cases & Mitigations

| Edge Case | Description | Severity | Platform Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **SMTP Authentication Failure** | Candidate Gmail App Password is changed or invalid. | High | SMTP driver catches `SMTPAuthenticationError` and automatically routes the dispatch to **IMAP Drafts** instead, saving the draft email locally and notifying the user. |
| **IMAP Draft Folder Missing** | Mailbox provider uses non-standard folder names (e.g. `INBOX.Drafts` vs `[Gmail]/Drafts`). | Medium | Appends draft by looping through folder fallback targets sequentially: `["[Gmail]/Drafts", "Drafts", "Draft", "INBOX.Drafts"]`. |
| **Recruiter Email Missing** | Scraped listing does not contain direct contact details. | Low | Auto-mapper populates recipient address with a fallback generic mailbox: `recruiting@company.com`. |

### 4.2. Verification & Testing Log
* **Run Date**: 2026-06-08
* **Status**: `[x] Passed`
* **Test Commands**:
  ```bash
  python packages/outreach/test_phase4.py
  pytest apps/server/tests/test_outreach.py
  ```
* **Observed Output**:
  ```
  PHASE 4 RESULTS: 6 passed, 0 failed. Evaluation status: ALL PASSED [OK]
  test_generate_outreach_endpoint, test_dispatch_outreach_endpoint_dry_run -> Passed
  ```

---

## Phase 5: Unified Status Dashboard

### 5.1. Edge Cases & Mitigations

| Edge Case | Description | Severity | Platform Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Status State Mismatch** | Database state is updated out-of-order (e.g., email marked as sent but no resume was tailored). | Medium | State machine controller restricts manual Kanban movements to valid transitions or triggers validation prompts. |
| **Credentials Cleared** | User deletes configuration fields during an active send process. | High | Session controllers validate credentials configuration status before executing background sidecar dispatches. |

### 5.2. Verification & Testing Log
* **Run Date**: 2026-06-08
* **Status**: `[x] Passed`
* **Test Commands**:
  ```bash
  npx tsc --noEmit
  pytest apps/server/tests/ -k test_get_all_applications_endpoint
  ```
* **Observed Output**:
  ```
  npx tsc --noEmit -> Success (exit 0)
  test_get_all_applications_endpoint -> Passed (1 passed)
  ```
