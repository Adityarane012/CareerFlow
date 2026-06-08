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

# We will use an in-memory SQLite for endpoint testing
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
        # Seed a test candidate and job listing
        with Session(engine) as session:
            user = User(
                id=uuid.UUID("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"),
                email="test@candidate.com",
                first_name="John",
                last_name="Doe"
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
            session.add(user)
            session.add(job)
            session.commit()
            
        yield client
    app.dependency_overrides.clear()

def test_trigger_scrape_endpoint(client: TestClient):
    payload = {
        "query": "python developer",
        "platforms": ["remoteok"],
        "user_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
    }
    resp = client.post("/api/v1/jobs/scrape", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "task_id" in data
    assert data["status"] == "pending"
    
    # Query task status
    task_id = data["task_id"]
    status_resp = client.get(f"/api/v1/jobs/scrape/{task_id}")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["status"] in ("pending", "running", "completed")

def test_shortlist_and_tailor_flow(client: TestClient):
    # 1. Shortlist the seeded job
    payload = {
        "user_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "job_id": "e5b8d234-7128-4ad3-9e4a-b5e19f7cc91f"
    }
    resp = client.post("/api/v1/jobs/shortlist", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "application_id" in data
    
    # 2. Persist tailoring updates
    app_id = data["application_id"]
    tailor_payload = {
        "application_id": app_id,
        "tailored_resume_text": "John Doe - Optimized Python CV...",
        "tailored_resume_url": "https://storage.net/resumes/john_optimized.pdf",
        "ats_score": 90,
        "gap_analysis_json": '{"gaps": ["Postgres"]}'
    }
    tailor_resp = client.post("/api/v1/applications/tailor", json=tailor_payload)
    assert tailor_resp.status_code == 200
    tailor_data = tailor_resp.json()
    assert tailor_data["status"] == "success"
    assert tailor_data["ats_score"] == 90
    
    # 3. Retrieve application details and logs
    details_resp = client.get(f"/api/v1/applications/{app_id}")
    assert details_resp.status_code == 200
    details_data = details_resp.json()
    assert details_data["company"] == "Cyberdyne"
    assert details_data["ats_score"] == 90
    assert details_data["status"] == "RESUME_TAILORED"
