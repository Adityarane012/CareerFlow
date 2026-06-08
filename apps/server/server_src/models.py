import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship

class User(SQLModel, table=True):
    __tablename__ = "users"
    
    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    email: str = Field(unique=True, index=True, nullable=False)
    first_name: str
    last_name: str
    base_resume_text: Optional[str] = None
    base_resume_url: Optional[str] = None
    smtp_host: str = Field(default="smtp.gmail.com")
    smtp_port: int = Field(default=587)
    smtp_user: Optional[str] = None
    smtp_password_encrypted: Optional[str] = None
    imap_host: str = Field(default="imap.gmail.com")
    imap_port: int = Field(default=993)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    applications: list["Application"] = Relationship(back_populates="user", cascade_delete=True)


class JobListing(SQLModel, table=True):
    __tablename__ = "job_listings"
    
    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    title: str = Field(nullable=False)
    company: str = Field(nullable=False)
    location: Optional[str] = None
    url: str = Field(nullable=False)
    platform: str = Field(nullable=False)  # 'Naukri', 'RemoteOK', 'Wellfound'
    description: Optional[str] = None
    scraped_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    applications: list["Application"] = Relationship(back_populates="job_listing", cascade_delete=True)


class Application(SQLModel, table=True):
    __tablename__ = "applications"
    
    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", nullable=False)
    job_id: uuid.UUID = Field(foreign_key="job_listings.id", nullable=False)
    status: str = Field(default="DISCOVERED")  # 'DISCOVERED', 'SHORTLISTED', 'RESUME_TAILORED', 'EMAIL_GENERATED', 'DRAFTED_IMAP', 'SENT_SMTP', 'ARCHIVED'
    tailored_resume_text: Optional[str] = None
    tailored_resume_url: Optional[str] = None
    ats_score: Optional[int] = None
    gap_analysis_json: Optional[str] = None  # JSON string
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: User = Relationship(back_populates="applications")
    job_listing: JobListing = Relationship(back_populates="applications")
    outreach_logs: list["OutreachLog"] = Relationship(back_populates="application", cascade_delete=True)


class OutreachLog(SQLModel, table=True):
    __tablename__ = "outreach_logs"
    
    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    application_id: uuid.UUID = Field(foreign_key="applications.id", nullable=False)
    recipient_name: str = Field(default="Hiring Manager")
    recipient_email: str = Field(nullable=False)
    subject: str = Field(nullable=False)
    body: str = Field(nullable=False)
    dispatch_type: str = Field(nullable=False)  # 'SMTP_SEND', 'IMAP_DRAFT', 'DRY_RUN'
    status: str = Field(nullable=False)         # 'sent', 'drafted', 'failed', 'dry_run'
    error_message: Optional[str] = None
    dispatched_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    application: Application = Relationship(back_populates="outreach_logs")
