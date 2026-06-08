import sys
import os
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool

# Include src directory in python path for test run
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from server_src.database import get_session
from server_src.models import User, JobListing, Application
from server_src.security import encrypt_password

@pytest.fixture(name="client")
def client_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    
    def override_get_session():
        with Session(engine) as session:
            yield session
            
    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as client:
        import uuid
        # Seed test candidate, job listing, and application
        with Session(engine) as session:
            user = User(
                id=uuid.UUID("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"),
                email="test@candidate.com",
                first_name="John",
                last_name="Doe",
                smtp_user="test@candidate.com",
                smtp_password_encrypted=encrypt_password("dummy_password", "super-secret-key-change-in-prod"),
                imap_host="imap.gmail.com",
                imap_port=993
            )
            job = JobListing(
                id=uuid.UUID("e5b8d234-7128-4ad3-9e4a-b5e19f7cc91f"),
                title="Python Developer",
                company="Cyberdyne",
                location="Remote",
                url="https://cyberdyne.com/jobs/1",
                platform="RemoteOK",
                description="Looking for Python FastAPI developer."
            )
            application = Application(
                id=uuid.UUID("7c35fa9e-4e8c-48c2-a9b8-a73c914bf682"),
                user_id=user.id,
                job_id=job.id,
                status="RESUME_TAILORED",
                tailored_resume_text="John Doe - Optimized Python Developer CV"
            )
            from server_src.models import OutreachLog
            outreach_log = OutreachLog(
                application_id=application.id,
                recipient_name="Sarah Connor",
                recipient_email="recruiter@cyberdyne.com",
                subject="Test Subject",
                body="Test Body",
                dispatch_type="DRY_RUN",
                status="dry_run"
            )
            session.add(user)
            session.add(job)
            session.add(application)
            session.add(outreach_log)
            session.commit()
            
        yield client
    app.dependency_overrides.clear()

def test_generate_outreach_endpoint(client: TestClient):
    payload = {
        "application_id": "7c35fa9e-4e8c-48c2-a9b8-a73c914bf682",
        "personalization_note": "saw your post on Twitter"
    }
    resp = client.post("/api/v1/outreach/generate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert data["status"] == "success"
    assert "subject" in data
    assert "body" in data

def test_dispatch_outreach_endpoint_dry_run(client: TestClient):
    payload = {
        "application_id": "7c35fa9e-4e8c-48c2-a9b8-a73c914bf682",
        "recipient_email": "recruiter@cyberdyne.com",
        "recipient_name": "Sarah Connor",
        "subject": "Application for Python Developer",
        "body": "Dear Sarah, ...",
        "dispatch_type": "IMAP_DRAFT"
    }
    # We patch DRY_RUN=true in the test env context to simulate IMAP/SMTP dispatches
    os.environ["DRY_RUN"] = "true"
    resp = client.post("/api/v1/outreach/dispatch", json=payload)
    print("RESPONSE STATUS:", resp.status_code)
    print("RESPONSE BODY:", resp.text)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "dry_run"
    assert data["application_status"] == "DRAFTED_IMAP"

def test_get_all_applications_endpoint(client: TestClient):
    resp = client.get("/api/v1/applications")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["job_title"] == "Python Developer"
    assert data[0]["status"] == "RESUME_TAILORED"

def test_delete_application_endpoint(client: TestClient):
    resp = client.get("/api/v1/applications")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    app_id = data[0]["application_id"]
    
    del_resp = client.delete(f"/api/v1/applications/{app_id}")
    assert del_resp.status_code == 200
    del_data = del_resp.json()
    assert del_data["status"] == "success"
    
    resp2 = client.get("/api/v1/applications")
    assert resp2.status_code == 200
    assert len(resp2.json()) == 0
