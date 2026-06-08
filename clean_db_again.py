import sys
import os

# Set search path to import server_src and packages/scrapers
sys.path.insert(0, os.path.abspath("apps/server"))
sys.path.insert(0, os.path.abspath("packages/scrapers"))

from sqlmodel import Session, select
from server_src.database import engine
from server_src.models import JobListing
from src.utils.text_cleaner import clean_html

with Session(engine) as session:
    jobs = session.exec(select(JobListing)).all()
    cleaned_count = 0
    for job in jobs:
        if job.description:
            original = job.description
            
            # Clean description using updated text_cleaner (which contains our anti-spam regex)
            cleaned = clean_html(original)
            
            if cleaned != original:
                job.description = cleaned
                session.add(job)
                cleaned_count += 1
                
    session.commit()
    print(f"Removed anti-spam verification footers from {cleaned_count} job descriptions inside career_agent.db!")
