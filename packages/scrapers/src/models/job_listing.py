from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class JobListing(BaseModel):
    title: str
    company: str
    location: str = ""
    platform: str
    url: str = ""
    posted_date: Optional[str] = None
    description: str = ""
    salary: str = ""
    job_type: str = ""

    @property
    def posted_date_parsed(self) -> Optional[datetime]:
        if self.posted_date:
            try:
                return datetime.fromisoformat(self.posted_date)
            except (ValueError, TypeError):
                pass
        return None
