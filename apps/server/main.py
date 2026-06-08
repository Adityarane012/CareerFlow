import os
import sys
import uuid
import concurrent.futures
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional, List

import contextlib

# Include root and packages in path for importing scrapers and outreach
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
SCRAPERS_PATH = os.path.join(ROOT_DIR, "packages", "scrapers")
OUTREACH_PATH = os.path.join(ROOT_DIR, "packages", "outreach")
SERVER_PATH = os.path.join(ROOT_DIR, "apps", "server")
if SCRAPERS_PATH not in sys.path:
    sys.path.append(SCRAPERS_PATH)
if OUTREACH_PATH not in sys.path:
    sys.path.append(OUTREACH_PATH)
if SERVER_PATH not in sys.path:
    sys.path.append(SERVER_PATH)

from server_src.database import create_db_and_tables, get_session, engine
from server_src.models import User, JobListing, Application, OutreachLog
from server_src.security import encrypt_password, decrypt_password

# Scraper Imports
from src.scrapers.naukri import fetch_naukri_jobs  # pyright: ignore [reportMissingImports]
from src.scrapers.remote_ok import fetch_remoteok_jobs  # pyright: ignore [reportMissingImports]
from src.scrapers.wellfound import fetch_wellfound_jobs  # pyright: ignore [reportMissingImports]
from src.utils.query_parser import parse_query  # pyright: ignore [reportMissingImports]
from src.utils.text_cleaner import clean_html  # pyright: ignore [reportMissingImports]

app = FastAPI(
    title="CareerFlow API",
    description="API Sidecar supporting job scraping, resume tailoring, and email outreach.",
    version="1.0.0"
)

# Enable CORS for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ENCRYPTION_SECRET = os.getenv("ENCRYPTION_SECRET", "super-secret-key-change-in-prod")

# Global task cache for background scraper threads
scraping_tasks = {}

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# ─────────────────────────────────────────────────────────────────────────────
# Request / Response Schemas
# ─────────────────────────────────────────────────────────────────────────────

class UserSetupRequest(BaseModel):
    email: str
    first_name: str
    last_name: str
    smtp_host: Optional[str] = "smtp.gmail.com"
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    imap_host: Optional[str] = "imap.gmail.com"
    imap_port: Optional[int] = 993

class ScrapeRequest(BaseModel):
    query: str
    platforms: List[str] = ["naukri", "remoteok", "wellfound"]
    user_id: Optional[str] = None

class ShortlistRequest(BaseModel):
    user_id: str
    job_id: str

class SaveTailorRequest(BaseModel):
    application_id: str
    tailored_resume_text: str
    tailored_resume_url: Optional[str] = None
    ats_score: int
    gap_analysis_json: Optional[str] = None

# ─────────────────────────────────────────────────────────────────────────────
# Background Task Runners
# ─────────────────────────────────────────────────────────────────────────────

def execute_scraping_job(task_id: str, query: str, platforms: List[str]):
    scraping_tasks[task_id] = {
        "status": "running",
        "message": "Scraper threads executing concurrently...",
        "jobs_found": 0,
        "platforms_processed": []
    }
    
    role, location = parse_query(query)
    all_listings = []
    futures_map = {}
    
    # Spawn concurrent scrapers using ThreadPoolExecutor
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        if "remoteok" in platforms:
            futures_map[executor.submit(fetch_remoteok_jobs, role, location)] = "RemoteOK"
        if "naukri" in platforms:
            futures_map[executor.submit(fetch_naukri_jobs, role, location)] = "Naukri"
        if "wellfound" in platforms:
            futures_map[executor.submit(fetch_wellfound_jobs, role, location)] = "Wellfound"
            
        for future in concurrent.futures.as_completed(futures_map):
            platform = futures_map[future]
            try:
                res = future.result()
                all_listings.extend(res)
                scraping_tasks[task_id]["platforms_processed"].append({
                    "platform": platform,
                    "status": "success",
                    "count": len(res)
                })
            except Exception as e:
                scraping_tasks[task_id]["platforms_processed"].append({
                    "platform": platform,
                    "status": "failed",
                    "count": 0,
                    "error": str(e)
                })
                
    # Ingest clean jobs in the DB (checking unique constraint manually to avoid conflicts)
    unique_inserted = 0
    with Session(engine) as session:
        for job in all_listings:
            stmt = select(JobListing).where(
                JobListing.title == job.title,
                JobListing.company == job.company,
                JobListing.platform == job.platform,
                JobListing.location == job.location
            )
            existing = session.exec(stmt).first()
            if not existing:
                cleaned_desc = clean_html(job.description or "")
                db_job = JobListing(
                    title=job.title,
                    company=job.company,
                    location=job.location or "",
                    url=job.url or "",
                    platform=job.platform,
                    description=cleaned_desc
                )
                session.add(db_job)
                unique_inserted += 1
        session.commit()
        
    scraping_tasks[task_id]["status"] = "completed"
    scraping_tasks[task_id]["message"] = "Concurrently scraped jobs saved to SQLite."
    scraping_tasks[task_id]["jobs_found"] = unique_inserted

# ─────────────────────────────────────────────────────────────────────────────
# Endpoints: Phase 1 Authentication & Setup
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/auth/setup", summary="Register or update candidate profile and SMTP/IMAP credentials")
def setup_user(req: UserSetupRequest, session: Session = Depends(get_session)):
    statement = select(User).where(User.email == req.email)
    user = session.exec(statement).first()
    
    encrypted_password = None
    if req.smtp_password:
        encrypted_password = encrypt_password(req.smtp_password, ENCRYPTION_SECRET)
        
    if not user:
        user = User(
            email=req.email,
            first_name=req.first_name,
            last_name=req.last_name,
            smtp_host=req.smtp_host,
            smtp_port=req.smtp_port,
            smtp_user=req.smtp_user or req.email,
            smtp_password_encrypted=encrypted_password,
            imap_host=req.imap_host,
            imap_port=req.imap_port
        )
        session.add(user)
    else:
        user.first_name = req.first_name
        user.last_name = req.last_name
        user.smtp_host = req.smtp_host
        user.smtp_port = req.smtp_port
        user.smtp_user = req.smtp_user or req.email
        user.imap_host = req.imap_host
        user.imap_port = req.imap_port
        if encrypted_password:
            user.smtp_password_encrypted = encrypted_password
        session.add(user)
        
    session.commit()
    session.refresh(user)
    
    return {
        "status": "success",
        "user_id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name
    }

class SaveResumeRequest(BaseModel):
    base_resume_text: str

@app.patch("/api/v1/users/{user_id}/resume", summary="Save or update base resume text for a user")
def save_base_resume(user_id: str, req: SaveResumeRequest, session: Session = Depends(get_session)):
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format.")

    user = session.get(User, user_uuid)
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found.")

    user.base_resume_text = req.base_resume_text
    session.add(user)
    session.commit()
    session.refresh(user)

    return {
        "status": "success",
        "user_id": str(user.id),
        "resume_length": len(req.base_resume_text),
        "message": "Base resume text saved successfully."
    }

@app.get("/api/v1/auth/config", summary="Verify credentials configuration status")
def get_user_config(email: str, session: Session = Depends(get_session)):
    statement = select(User).where(User.email == email)
    user = session.exec(statement).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email {email} not found."
        )
        
    return {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "smtp_configured": bool(user.smtp_user and user.smtp_password_encrypted),
        "imap_configured": bool(user.imap_host and user.imap_port)
    }

# ─────────────────────────────────────────────────────────────────────────────
# Endpoints: Phase 2 Discovery Scraper
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/jobs/scrape", summary="Trigger concurrent multi-threaded scrape worker")
def trigger_scrape(req: ScrapeRequest, background_tasks: BackgroundTasks):
    task_id = f"task_scrape_{uuid.uuid4().hex[:8]}"
    scraping_tasks[task_id] = {
        "status": "pending",
        "message": "Scrape task initiated concurrently for requested platforms.",
        "jobs_found": 0,
        "platforms_processed": []
    }
    
    # Run scraping task asynchronously in background
    background_tasks.add_task(
        execute_scraping_job,
        task_id=task_id,
        query=req.query,
        platforms=[p.lower() for p in req.platforms]
    )
    
    return {
        "task_id": task_id,
        "status": "pending",
        "message": "Scrape task started concurrently for specified platforms."
    }

@app.get("/api/v1/jobs/scrape/{task_id}", summary="Get background scraping job status")
def get_scrape_status(task_id: str):
    if task_id not in scraping_tasks:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scrape task ID {task_id} not found."
        )
    return scraping_tasks[task_id]

@app.get("/api/v1/jobs", summary="Retrieve scraped job listings")
def get_job_listings(
    platform: Optional[str] = None, 
    search: Optional[str] = None, 
    session: Session = Depends(get_session)
):
    stmt = select(JobListing)
    if platform:
        stmt = stmt.where(JobListing.platform == platform)
    if search:
        stmt = stmt.where(
            (JobListing.title.like(f"%{search}%")) | 
            (JobListing.company.like(f"%{search}%")) |
            (JobListing.description.like(f"%{search}%"))
        )
    # Order by newest first
    stmt = stmt.order_by(JobListing.scraped_at.desc())
    results = session.exec(stmt).all()
    return results

@app.get("/api/v1/jobs/{job_id}", summary="Get details of a single job listing")
def get_job_details(job_id: str, session: Session = Depends(get_session)):
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format.")
        
    job = session.get(JobListing, job_uuid)
    if not job:
        raise HTTPException(status_code=404, detail="Job listing not found.")
    return job

# ─────────────────────────────────────────────────────────────────────────────
# Endpoints: Phase 3 Ingestion & Shortlist
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/jobs/shortlist", summary="Shortlist a job listing (create Application)")
def shortlist_job(req: ShortlistRequest, session: Session = Depends(get_session)):
    try:
        user_uuid = uuid.UUID(req.user_id)
        job_uuid = uuid.UUID(req.job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID formats.")
        
    # Check if user and job exist
    user = session.get(User, user_uuid)
    job = session.get(JobListing, job_uuid)
    if not user or not job:
        raise HTTPException(status_code=404, detail="User or Job listing not found.")
        
    # Check if already shortlisted
    stmt = select(Application).where(Application.user_id == user_uuid, Application.job_id == job_uuid)
    existing = session.exec(stmt).first()
    if existing:
        return {
            "status": "exists",
            "application_id": str(existing.id),
            "message": "Job listing is already shortlisted."
        }
        
    app_record = Application(
        user_id=user_uuid,
        job_id=job_uuid,
        status="SHORTLISTED"
    )
    session.add(app_record)
    session.commit()
    session.refresh(app_record)
    
    return {
        "status": "success",
        "application_id": str(app_record.id),
        "message": "Job listing successfully shortlisted."
    }

@app.post("/api/v1/applications/tailor", summary="Save tailored resume details inside database applications table")
def save_tailored_resume(req: SaveTailorRequest, session: Session = Depends(get_session)):
    try:
        app_uuid = uuid.UUID(req.application_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid application ID format.")
        
    app_record = session.get(Application, app_uuid)
    if not app_record:
        raise HTTPException(status_code=404, detail="Application record not found.")
        
    app_record.tailored_resume_text = req.tailored_resume_text
    app_record.tailored_resume_url = req.tailored_resume_url
    app_record.ats_score = req.ats_score
    app_record.gap_analysis_json = req.gap_analysis_json
    app_record.status = "RESUME_TAILORED"
    app_record.updated_at = datetime.utcnow()
    
    session.add(app_record)
    session.commit()
    session.refresh(app_record)
    
    return {
        "status": "success",
        "application_id": str(app_record.id),
        "ats_score": app_record.ats_score,
        "message": "Tailored resume details successfully persisted."
    }

@app.get("/api/v1/applications", summary="Retrieve all job applications with their state and job details")
def get_all_applications(session: Session = Depends(get_session)):
    stmt = select(Application).order_by(Application.created_at.desc())
    results = session.exec(stmt).all()
    
    return [
        {
            "application_id": str(app_record.id),
            "user_id": str(app_record.user_id),
            "job_id": str(app_record.job_id),
            "status": app_record.status,
            "job_title": app_record.job_listing.title,
            "company": app_record.job_listing.company,
            "location": app_record.job_listing.location,
            "url": app_record.job_listing.url,
            "ats_score": app_record.ats_score,
            "tailored_resume_url": app_record.tailored_resume_url,
            "created_at": app_record.created_at
        }
        for app_record in results
    ]

@app.get("/api/v1/applications/{application_id}", summary="Get application detailing logs and resume states")
def get_application_details(application_id: str, session: Session = Depends(get_session)):
    try:
        app_uuid = uuid.UUID(application_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid application ID format.")
        
    app_record = session.get(Application, app_uuid)
    if not app_record:
        raise HTTPException(status_code=404, detail="Application record not found.")
        
    return {
        "application_id": str(app_record.id),
        "user_id": str(app_record.user_id),
        "job_id": str(app_record.job_id),
        "status": app_record.status,
        "job_title": app_record.job_listing.title,
        "company": app_record.job_listing.company,
        "location": app_record.job_listing.location,
        "url": app_record.job_listing.url,
        "scraped_description": app_record.job_listing.description,
        "base_resume_text": app_record.user.base_resume_text,
        "tailored_resume_text": app_record.tailored_resume_text,
        "tailored_resume_url": app_record.tailored_resume_url,
        "ats_score": app_record.ats_score,
        "gap_analysis": app_record.gap_analysis_json
    }

@app.delete("/api/v1/applications/{application_id}", summary="Delete an application (Unshortlist a job)")
def delete_application(application_id: str, session: Session = Depends(get_session)):
    try:
        app_uuid = uuid.UUID(application_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid application ID format.")
        
    app_record = session.get(Application, app_uuid)
    if not app_record:
        raise HTTPException(status_code=404, detail="Application record not found.")
        
    try:
        # Manually delete any associated outreach logs first to prevent foreign key violations
        statement = select(OutreachLog).where(OutreachLog.application_id == app_uuid)
        logs = session.exec(statement).all()
        for log in logs:
            session.delete(log)
            
        session.delete(app_record)
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"DATABASE ERROR ON APPLICATION DELETE: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")
    
    return {
        "status": "success",
        "message": "Application successfully deleted (unshortlisted)."
    }

# ─────────────────────────────────────────────────────────────────────────────
# Request / Response Schemas for Phase 4 Outreach
# ─────────────────────────────────────────────────────────────────────────────

class OutreachGenerateRequest(BaseModel):
    application_id: str
    personalization_note: Optional[str] = ""

class OutreachDispatchRequest(BaseModel):
    application_id: str
    recipient_email: str
    recipient_name: Optional[str] = "Hiring Manager"
    subject: str
    body: str
    dispatch_type: str  # 'SMTP_SEND' or 'IMAP_DRAFT'

# ─────────────────────────────────────────────────────────────────────────────
# Endpoints: Phase 4 Outreach Console
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/outreach/generate", summary="Generate personalized cold outreach email")
def generate_outreach(req: OutreachGenerateRequest, session: Session = Depends(get_session)):
    try:
        app_uuid = uuid.UUID(req.application_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid application ID format.")
        
    app_record = session.get(Application, app_uuid)
    if not app_record:
        raise HTTPException(status_code=404, detail="Application not found.")
        
    user = app_record.user
    job = app_record.job_listing
    
    # Context mapping automatically
    contact_record = {
        "role": job.title,
        "company": job.company,
        "job_url": job.url,
        "personalization_note": req.personalization_note,
        "candidate_name": f"{user.first_name} {user.last_name}",
        "candidate_background": app_record.tailored_resume_text or user.base_resume_text or "",
        "recipient_name": "Hiring Manager",
        "recipient_email": "recruiting@company.com"
    }
    
    # Ensure OUTREACH_PATH in sys.path and import email_generator
    if OUTREACH_PATH not in sys.path:
        sys.path.insert(0, OUTREACH_PATH)
    from email_generator import generate_email  # pyright: ignore [reportMissingImports]
    
    try:
        subject, body = generate_email(contact_record)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email generation failed: {str(e)}")
        
    return {
        "status": "success",
        "recipient_name": contact_record["recipient_name"],
        "recipient_email": contact_record["recipient_email"],
        "subject": subject,
        "body": body
    }

@contextlib.contextmanager
def patch_env(**kwargs):
    originals = {k: os.environ.get(k) for k in kwargs}
    for k, v in kwargs.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = str(v)
    try:
        yield
    finally:
        for k, orig in originals.items():
            if orig is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = orig

@app.post("/api/v1/outreach/dispatch", summary="Dispatch email via SMTP or save draft via IMAP")
def dispatch_outreach(req: OutreachDispatchRequest, session: Session = Depends(get_session)):
    try:
        app_uuid = uuid.UUID(req.application_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid application ID format.")
        
    app_record = session.get(Application, app_uuid)
    if not app_record:
        raise HTTPException(status_code=404, detail="Application not found.")
        
    user = app_record.user
    
    # Decrypt credentials
    decrypted_pass = ""
    if user.smtp_password_encrypted:
        try:
            decrypted_pass = decrypt_password(user.smtp_password_encrypted, ENCRYPTION_SECRET)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Decryption of credentials failed: {str(e)}")
            
    # Import email sender routines
    if OUTREACH_PATH not in sys.path:
        sys.path.insert(0, OUTREACH_PATH)
    from email_sender import send_email_smtp, save_draft_imap  # pyright: ignore [reportMissingImports]
    
    status_str = "failed"
    error_message = None
    
    # Check if credentials exist (if we're not in dry run)
    dry_run = os.getenv("DRY_RUN", "true").lower() == "true"
    
    if not dry_run and (not user.smtp_user or not decrypted_pass):
        status_str = "failed"
        error_message = "Missing credentials"
    else:
        if req.dispatch_type == "SMTP_SEND":
            # Attempt SMTP send
            with patch_env(
                DRY_RUN="false" if not dry_run else "true",
                SMTP_USER=user.smtp_user or "",
                SMTP_PASSWORD=decrypted_pass,
                SMTP_HOST=user.smtp_host or "smtp.gmail.com",
                SMTP_PORT=str(user.smtp_port or 587)
            ):
                status_str, error_message = send_email_smtp(
                    recipient_email=req.recipient_email,
                    subject=req.subject,
                    body=req.body,
                    sender_name=f"{user.first_name} {user.last_name}"
                )
                
            # Edge-case fallback: SMTP failure (credentials/server issues) fallbacks to IMAP Draft!
            if status_str == "failed" and not dry_run:
                fallback_msg = f"SMTP dispatch failed ({error_message}). Attempting automatic fallback to IMAP draft..."
                print(fallback_msg)
                # Attempt IMAP draft fallback
                with patch_env(
                    DRY_RUN="false",
                    SMTP_USER=user.smtp_user or "",
                    SMTP_PASSWORD=decrypted_pass,
                    IMAP_USER=user.smtp_user or "",
                    IMAP_PASSWORD=decrypted_pass,
                    IMAP_HOST=user.imap_host or "imap.gmail.com",
                    IMAP_PORT=str(user.imap_port or 993)
                ):
                    status_str_imap, error_message_imap = save_draft_imap(
                        recipient_email=req.recipient_email,
                        subject=req.subject,
                        body=req.body,
                        sender_name=f"{user.first_name} {user.last_name}"
                    )
                if status_str_imap == "drafted":
                    status_str = "drafted"
                    error_message = f"SMTP send failed ({error_message}). Saved to IMAP Drafts instead."
                else:
                    error_message = f"SMTP send failed ({error_message}) and IMAP fallback failed ({error_message_imap})."
                    
        elif req.dispatch_type == "IMAP_DRAFT":
            # Save IMAP draft
            with patch_env(
                DRY_RUN="false" if not dry_run else "true",
                SMTP_USER=user.smtp_user or "",
                SMTP_PASSWORD=decrypted_pass,
                IMAP_USER=user.smtp_user or "",
                IMAP_PASSWORD=decrypted_pass,
                IMAP_HOST=user.imap_host or "imap.gmail.com",
                IMAP_PORT=str(user.imap_port or 993)
            ):
                status_str, error_message = save_draft_imap(
                    recipient_email=req.recipient_email,
                    subject=req.subject,
                    body=req.body,
                    sender_name=f"{user.first_name} {user.last_name}"
                )
        else:
            raise HTTPException(status_code=400, detail="Invalid dispatch_type.")
            
    # Update application pipeline status
    if status_str == "sent" or status_str == "dry_run" and req.dispatch_type == "SMTP_SEND":
        app_record.status = "SENT_SMTP"
    elif status_str == "drafted" or status_str == "dry_run" and req.dispatch_type == "IMAP_DRAFT":
        app_record.status = "DRAFTED_IMAP"
        
    app_record.updated_at = datetime.utcnow()
    session.add(app_record)
    
    # Save outreach log entry
    log_record = OutreachLog(
        application_id=app_record.id,
        recipient_name=req.recipient_name or "Hiring Manager",
        recipient_email=req.recipient_email,
        subject=req.subject,
        body=req.body,
        dispatch_type=req.dispatch_type,
        status=status_str,
        error_message=error_message
    )
    session.add(log_record)
    session.commit()
    session.refresh(app_record)
    
    return {
        "status": status_str,
        "application_status": app_record.status,
        "error_message": error_message,
        "message": "Outreach dispatch process completed."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
