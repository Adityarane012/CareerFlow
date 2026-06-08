# The Closer — Cold Email Writer + Send Bot

**The Closer** is a modular, CLI-driven cold email agent designed for job seekers. It personalizes job outreach templates using target info (role, company, background hooks), lets the user review and confirm each email, and programmatically drafts (via IMAP) or sends (via SMTP) them.

---

## Features

1. **Safety First**: Runs in `DRY_RUN=true` mode by default — no real network traffic or email activity until you are ready.
2. **Interactive Confirmation**: Every email is previewed in full inside the terminal. Confirm whether to **Send**, **Draft**, **Skip**, or **Quit** per contact.
3. **IMAP Draft Mode**: Creates drafts directly in your Gmail/IMAP `Drafts` folder using your App Password — giving you a final chance to edit before sending.
4. **SMTP Send Mode**: Sends emails via secure SMTP with STARTTLS (port 587).
5. **Groq LLM Personalization (Optional)**: If `GROQ_API_KEY` is set, emails are rewritten by Groq's `llama-3.3-70b-versatile` model for premium quality. Falls back to deterministic templates automatically if the key is absent or the API fails.
6. **Structured Logging**: Generates `outreach_log.csv` with timestamp, target, subject, and status for every action. Internal diagnostics written to `app.log`.

---

## Prerequisites

- Python 3.8+
- A Gmail account with **2-Step Verification** enabled
- A **Gmail App Password** (16-character code) — used for both SMTP send and IMAP draft
- *(Optional)* A free [Groq API key](https://console.groq.com) for LLM-powered email rewriting

---

## Installation & Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure environment
```bash
cp .env.example .env
```

Open `.env` and fill in the following:

| Variable | Required | Description |
|---|---|---|
| `SMTP_HOST` | Yes | `smtp.gmail.com` |
| `SMTP_PORT` | Yes | `587` |
| `SMTP_USER` | Yes | Your Gmail address |
| `SMTP_PASSWORD` | Yes | Your Gmail App Password |
| `IMAP_HOST` | Yes | `imap.gmail.com` |
| `IMAP_PORT` | Yes | `993` |
| `SENDER_NAME` | Yes | Your display name in emails |
| `DRY_RUN` | Yes | `true` to test safely, `false` to send/draft for real |
| `GROQ_API_KEY` | No | Groq API key for LLM-powered rewriting |
| `GROQ_MODEL` | No | Defaults to `llama-3.3-70b-versatile` |

### 3. Add your outreach targets
Edit `contacts.json`. Required fields per record:

```json
{
  "recipient_name": "Jane Smith",
  "recipient_email": "jane@company.com",
  "company": "Company Name",
  "role": "Role Title",
  "candidate_name": "Your Name",
  "candidate_background": "Brief background statement"
}
```

Optional fields: `job_url`, `personalization_note`, `portfolio_url`.

---

## Security: Gmail App Passwords

Never use your primary Gmail password. Use an App Password instead:

1. Go to **Google Account → Security**.
2. Enable **2-Step Verification** (required).
3. Search for **App Passwords**.
4. Create a new app password (e.g., name it `TheCloserBot`).
5. Copy the 16-character code → paste as `SMTP_PASSWORD` in `.env`.

> The same App Password is reused for IMAP draft creation.

---

## How to Run

### Web Interface (Stitch Frontend)
Run the FastAPI backend server:
```bash
python api/server.py
```
Then open: [http://localhost:8000](http://localhost:8000) to compose, generate, review, and send/draft your cold emails.

### Command Line Interface (CLI)
```bash
# Safe test run — no emails sent
python main.py
```

**CLI actions per contact:**

| Key | Action |
|---|---|
| `s` | Send email via SMTP |
| `d` | Save as draft via IMAP |
| `k` | Skip this contact |
| `q` | Quit the session |

---

## Running Phase Tests

```bash
python test_phase1.py    # Config & contacts validation
python test_phase2.py    # Email generator (template + Groq)
python test_phase3.py    # Logger CSV integrity
python test_phase4.py    # SMTP/IMAP dry-run safety
```

---

## Output Files

| File | Description |
|---|---|
| `outreach_log.csv` | CSV log of every action (sent / drafted / skipped / failed / dry_run) |
| `app.log` | Internal diagnostic log with timestamps and module traces |
