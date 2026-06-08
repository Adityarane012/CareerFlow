import sys
import os
import pytest
from sqlmodel import SQLModel, create_engine, Session, select

# Include src directory in python path for test run
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server_src.models import User, JobListing, Application, OutreachLog

@pytest.fixture(name="session")
def session_fixture():
    # Use in-memory SQLite database for testing
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        yield session

def test_database_models_relationship_and_cascade(session: Session):
    # 1. Create a user
    user = User(
        email="test@candidate.com",
        first_name="Alice",
        last_name="Smith",
        smtp_user="test@candidate.com",
        smtp_password_encrypted="EncryptedTokenString123"
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    assert user.id is not None
    
    # 2. Create a job listing
    job = JobListing(
        title="Software Engineer",
        company="Tech Corp",
        location="Remote",
        url="https://techcorp.com/jobs/1",
        platform="RemoteOK",
        description="We are looking for a Software Engineer experienced in Python."
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    assert job.id is not None
    
    # 3. Create an application linking user and job
    app = Application(
        user_id=user.id,
        job_id=job.id,
        status="SHORTLISTED",
        ats_score=85,
        gap_analysis_json='{"missing_skills": ["FastAPI"]}'
    )
    session.add(app)
    session.commit()
    session.refresh(app)
    assert app.id is not None
    assert app.user.first_name == "Alice"
    assert app.job_listing.company == "Tech Corp"
    
    # 4. Create an outreach log entry linked to application
    log = OutreachLog(
        application_id=app.id,
        recipient_name="Bob HR",
        recipient_email="bob@techcorp.com",
        subject="Application for Software Engineer",
        body="Dear Bob, ...",
        dispatch_type="IMAP_DRAFT",
        status="drafted"
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    assert log.id is not None
    assert log.application.status == "SHORTLISTED"
    
    # 5. Test Cascading: Delete User and verify cascade deletion of Application and OutreachLog
    session.delete(user)
    session.commit()
    
    # Check that Application is deleted
    assert session.exec(select(Application).where(Application.id == app.id)).first() is None
    # Check that OutreachLog is deleted
    assert session.exec(select(OutreachLog).where(OutreachLog.id == log.id)).first() is None
    # Check that JobListing is NOT deleted (since it is not owned by user)
    assert session.exec(select(JobListing).where(JobListing.id == job.id)).first() is not None
