"""
api/server.py — FastAPI backend for The Closer (Stitch frontend integration)

Exposes 4 REST endpoints that wrap the core pipeline modules:
  GET  /api/contacts        → returns contacts.json
  POST /api/generate        → calls email_generator.generate_email()
  POST /api/deliver         → calls email_sender + logger
  GET  /api/log             → returns outreach_log.csv as JSON

Also serves the Stitch-generated frontend as static files from:
  frontend/   ← drop your Stitch HTML/CSS/JS files here

Run with:
  python api/server.py
Then open: http://localhost:8000
"""

import os
import sys
import json
import csv
import logging

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Path setup: import sibling core modules from project root ─────────────────
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_DIR = os.path.join(ROOT, "frontend")
CONTACTS_PATH = os.path.join(ROOT, "contacts.json")
LOG_PATH = os.path.join(ROOT, "outreach_log.csv")

if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(ROOT, ".env"))

# Core pipeline modules — no logic duplicated here
from email_generator import generate_email
from email_sender import send_email_smtp, save_draft_imap
from logger import log_outreach

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(ROOT, "app.log"), encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
_log = logging.getLogger("the_closer.api")

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="The Closer — API",
    description="REST API wrapping the cold email pipeline for the Stitch frontend.",
    version="1.0.0",
)

# Allow the Stitch frontend to call this API (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Request / Response models
# ─────────────────────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    contact_index: int   # index into contacts.json array


class DeliverRequest(BaseModel):
    contact_index: int
    subject: str
    body: str
    action: str          # "send" | "draft" | "skip"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _load_contacts():
    if not os.path.exists(CONTACTS_PATH):
        raise HTTPException(status_code=404, detail="contacts.json not found")
    with open(CONTACTS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _get_contact(index: int):
    contacts = _load_contacts()
    if index < 0 or index >= len(contacts):
        raise HTTPException(status_code=400, detail=f"Contact index {index} out of range")
    return contacts[index]


# ─────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/contacts", summary="Return all outreach contacts")
def get_contacts():
    """
    Returns the full contacts.json list with index added to each record.
    The frontend uses this to populate the contact picker dropdown.
    """
    contacts = _load_contacts()
    return [{"index": i, **c} for i, c in enumerate(contacts)]


@app.get("/api/config", summary="Return safe runtime config for the UI")
def get_config():
    """Returns non-sensitive config so the UI can display the mode banner."""
    return {
        "dry_run": os.getenv("DRY_RUN", "true").lower() == "true",
        "sender_name": os.getenv("SENDER_NAME", "Job Seeker"),
        "groq_available": bool(os.getenv("GROQ_API_KEY", "").strip()),
        "groq_model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
    }


@app.post("/api/generate", summary="Generate personalized email for a contact")
def api_generate(req: GenerateRequest):
    """
    Calls email_generator.generate_email() for the selected contact.
    Returns {subject, body, word_count}.
    Falls back to deterministic template if Groq fails.
    """
    contact = _get_contact(req.contact_index)
    _log.info(f"[API] generate_email for {contact.get('company')} - {contact.get('role')}")

    try:
        subject, body = generate_email(contact)
    except Exception as e:
        _log.error(f"[API] generate_email error: {e}")
        raise HTTPException(status_code=500, detail=f"Email generation failed: {e}")

    return {
        "subject": subject,
        "body": body,
        "word_count": len(body.split()),
    }


@app.post("/api/deliver", summary="Send, draft, or skip an outreach email")
def api_deliver(req: DeliverRequest):
    """
    Dispatches the chosen action (send / draft / skip) through the core sender,
    then logs the result via logger.log_outreach().

    Returns {status, error} where status is one of:
      sent | drafted | dry_run | skipped | failed
    """
    contact = _get_contact(req.contact_index)
    sender_name = os.getenv("SENDER_NAME", "Job Seeker")
    recipient = contact.get("recipient_email", "")
    company   = contact.get("company", "")
    role      = contact.get("role", "")

    status, error = "skipped", None

    if req.action == "send":
        _log.info(f"[API] SMTP send -> {recipient}")
        status, error = send_email_smtp(
            recipient_email=recipient,
            subject=req.subject,
            body=req.body,
            sender_name=sender_name,
        )

    elif req.action == "draft":
        _log.info(f"[API] IMAP draft -> {recipient}")
        status, error = save_draft_imap(
            recipient_email=recipient,
            subject=req.subject,
            body=req.body,
            sender_name=sender_name,
        )

    elif req.action == "skip":
        _log.info(f"[API] skip -> {recipient}")
        status, error = "skipped", None

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action '{req.action}'. Use: send | draft | skip")

    # Always log — mirrors main.py behaviour
    log_outreach(
        recipient_email=recipient,
        company=company,
        role=role,
        subject=req.subject,
        status=status,
        error_message=error or "",
    )

    return {
        "status": status,
        "error": error,
        "recipient_email": recipient,
    }


@app.get("/api/log", summary="Return outreach log as JSON")
def get_log():
    """
    Reads outreach_log.csv and returns all rows as a JSON array.
    Newest entries are returned first.
    """
    if not os.path.exists(LOG_PATH):
        return []
    with open(LOG_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return list(reversed(rows))   # newest first


# ─────────────────────────────────────────────────────────────────────────────
# Serve the Stitch frontend (static files)
# Drop your Stitch HTML/CSS/JS into the  frontend/  folder
# ─────────────────────────────────────────────────────────────────────────────

if os.path.isdir(FRONTEND_DIR):
    # Serve index.html at root
    @app.get("/", include_in_schema=False)
    def serve_index():
        index = os.path.join(FRONTEND_DIR, "index.html")
        if not os.path.exists(index):
            return JSONResponse({"detail": "index.html not found in frontend/"}, status_code=404)
        return FileResponse(index)

    # Serve all other static assets (CSS, JS, images, fonts)
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:
    @app.get("/", include_in_schema=False)
    def no_frontend():
        return JSONResponse({
            "message": "API is running. Drop your Stitch files into the 'frontend/' folder to serve the UI.",
            "docs": "http://localhost:8000/docs",
        })


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    _log.info("Starting The Closer API server on http://localhost:8000")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True, app_dir=os.path.dirname(__file__))
