import csv
from pathlib import Path
from typing import Iterable

from src.models.job_listing import JobListing

CSV_HEADERS = [
    "title",
    "company",
    "location",
    "url",
    "source",
    "date_posted",
    "scraped_at",
]


def save_jobs_to_csv(jobs: Iterable[JobListing], path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    from datetime import datetime
    scraped_at_val = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with open(path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()
        for job in jobs:
            row = {
                "title": job.title,
                "company": job.company,
                "location": job.location,
                "url": job.url,
                "source": job.platform,
                "date_posted": job.posted_date,
                "scraped_at": scraped_at_val,
            }
            writer.writerow(row)

    return path
