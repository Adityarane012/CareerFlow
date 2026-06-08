# Edge Cases & Failure Mode Analysis

This document identifies potential edge cases across all subsystems of **The Closer** and documents the expected system behavior or mitigation strategies.

---

## 1. Input & Configuration Edge Cases

| Edge Case | Description | Expected System Behavior / Mitigation |
| :--- | :--- | :--- |
| **Missing `.env` File** | The file is completely absent. | Application prints an error message instructing the user to configure `.env`, then exits with code `1`. |
| **Missing Critical Keys** | `SMTP_USER` or `SMTP_PASSWORD` is blank in live mode. | The orchestrator detects this before launching the main loop and exits with an error. |
| **Malformed `contacts.json`** | JSON syntax errors (e.g., missing commas, trailing quotes). | `json.JSONDecodeError` is caught during load, printing a descriptive parser warning and exiting cleanly. |
| **Empty Contacts List** | `contacts.json` contains `[]`. | System prints a message indicating 0 targets loaded and exits successfully without prompt loops. |
| **Missing Optional Fields** | Contact record is missing `portfolio_url` or `personalization_note`. | The template/generator skips the optional blocks or replaces them with general placeholders without throwing key errors. |
| **Special Characters in Fields** | Recipient names/titles containing accents, non-ASCII characters, or quotes. | UTF-8 encoding is enforced during JSON reads, preventing encoding/decoding errors. |

---

## 2. Content Generation Edge Cases

| Edge Case | Description | Expected System Behavior / Mitigation |
| :--- | :--- | :--- |
| **Groq API Down / Offline** | Network block or API service outage during LLM rewrite. | The `generate_email` function catches the API connection exceptions, logs a warning, and falls back to the deterministic python templates. |
| **Groq API Quota Exceeded** | Rate limits reached on free/low tiers. | Safe exception handling catches resource exhaustion and triggers fallback template generation. |
| **Extremely Long Personalization Note** | Personalization input is too long (e.g. pasted paragraphs). | - Template mode inserts it as-is (email might exceed 150 words).<br>- Groq mode uses prompt constraints to rewrite and compress the length back down under 150 words. |
| **No Personalization Hook Provided** | The personalization hook in `contacts.json` is blank. | The generator uses a default generic opening hook (e.g., "I noticed your company is hiring for...") without losing template grammar structure. |

---

## 3. Delivery Subsystem (SMTP/IMAP) Edge Cases

| Edge Case | Description | Expected System Behavior / Mitigation |
| :--- | :--- | :--- |
| **Invalid Authentication** | Incorrect app password or username. | `smtplib.SMTPAuthenticationError` or `imaplib.IMAP4.error` is caught, returning status `failed` with the specific error string. |
| **Port Blocked by ISP** | Port 587 is blocked by local network security/ISP. | The socket times out, and the sender catches the connection timeout error, reporting a descriptive failure message instead of crashing. |
| **Missing IMAP Draft Folder** | Server does not have `[Gmail]/Drafts` folder structure (non-Gmail or custom domain). | The draft module attempts `[Gmail]/Drafts`, `Drafts`, `Draft`, and `INBOX.Drafts` sequentially. If all fail, it logs the specific error. |
| **Mails to Self** | `SMTP_USER` is identical to `recipient_email`. | SMTP and IMAP handle this natively (perfect for self-testing). |
| **Accidental Send in Live Mode** | User makes a mistake during interactive review. | The CLI forces the user to type explicit key inputs (`s`/`d`/`k`/`q`) and double-checks inputs to prevent accidental triggers. |

---

## 4. Logging & Auditing Edge Cases

| Edge Case | Description | Expected System Behavior / Mitigation |
| :--- | :--- | :--- |
| **Log File Locked / Read-Only** | `outreach_log.csv` is open in Excel or another program, locking write access. | `PermissionError` is caught. The app prints a terminal warning that logging failed but continues the outreach loop so the user doesn't lose progress. |
| **CSV Injection** | Subjects or candidate names containing Excel formula characters (e.g., `=`, `+`, `-`, `@`). | CSV fields are properly escaped and written using Python's standard `csv` library. |
| **Concurrent Writes** | Multiple instances running at the same time. | Standard file append modes are used, which is robust on modern operating systems for sequential appends. |
