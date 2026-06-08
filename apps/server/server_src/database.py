import os
from sqlmodel import SQLModel, create_engine, Session
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./career_agent.db")

# SQLite needs connect_args={"check_same_thread": False} to run on multiple concurrent threads
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)

def create_db_and_tables():
    """Initializes the SQLite/PostgreSQL database structures."""
    SQLModel.metadata.create_all(engine)

def get_session():
    """Yields a database session."""
    with Session(engine) as session:
        yield session
