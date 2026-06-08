import re

from firecrawl import V1FirecrawlApp

from src.models.job_listing import JobListing
from src.utils.config import get_firecrawl_api_key
from src.utils.text_cleaner import clean_html

SEARCH_URL = "https://wellfound.com/jobs?q={query}"
SEARCH_URL_WITH_LOC = "https://wellfound.com/jobs?q={query}&l={location}"


def fetch_wellfound_jobs(query: str, location: str = "") -> list[JobListing]:
    api_key = get_firecrawl_api_key()
    if not api_key:
        print("[Wellfound] FIRECRAWL_API_KEY not set — skipping")
        return []

    app = V1FirecrawlApp(api_key=api_key)
    if location:
        url = SEARCH_URL_WITH_LOC.format(query=query, location=location)
    else:
        url = SEARCH_URL.format(query=query)

    try:
        result = app.scrape_url(url, formats=["markdown"], proxy="stealth")
    except Exception as e:
        print(f"[Wellfound] Firecrawl scrape failed: {e}")
        return []

    if not result or not result.success:
        print("[Wellfound] Firecrawl scrape was not successful")
        return []

    markdown = result.markdown or ""
    if not markdown:
        print("[Wellfound] No markdown content in Firecrawl response")
        return []

    return _parse_listings(markdown, query, location)


def _parse_listings(markdown: str, query: str, search_location: str = "") -> list[JobListing]:
    jobs: list[JobListing] = []
    lines = markdown.split("\n")

    # Wellfound markdown pattern:
    #   [Job Title](https://wellfound.com/jobs/{id}-title)
    #   Company � Location � $salary � $equity � date
    #
    # Some lines have richer info:
    #   Company � Onsite or remote � City �+N more � $min � $max � equity � date
    #   Company � In office � City �$min � $max � equity � date
    #   Company � Remote only � Everywhere �$min � $max � No equity � date

    job_link_pattern = re.compile(r"^\[(.+?)\]\((https://wellfound\.com/jobs/\d+-.+?)\)$")
    detail_pattern = re.compile(
        r"^(.+?)\s*[•·]\s*(.+?)\s*[•·]\s*(.+?)(?:\s*[•·]\s*(.*))?(?:\s*[•·]\s*(?:No equity)?.*)?$"
    )

    query_lower = query.lower()
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Look for job title link
        link_match = job_link_pattern.match(line)
        if link_match:
            title = link_match.group(1).strip()
            url = link_match.group(2)

            # Check if title matches query (synonym-aware for developer/engineer)
            query_words = [w.strip() for w in query_lower.split() if w.strip()]
            matched = True
            for word in query_words:
                synonyms = [word]
                if word == "developer":
                    synonyms.extend(["engineer", "dev", "programmer"])
                elif word == "engineer":
                    synonyms.extend(["developer", "dev", "programmer"])
                
                word_matched = False
                for syn in synonyms:
                    if syn in title.lower():
                        word_matched = True
                        break
                if not word_matched:
                    matched = False
                    break

            if not matched:
                i += 1
                continue

            # Next non-empty line (typically 2 lines down) has company/detail
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1

            if j < len(lines):
                detail_line = lines[j].strip()
                # Skip logo lines
                if detail_line.startswith("[!"):
                    j += 1
                    while j < len(lines) and not lines[j].strip():
                        j += 1
                    if j < len(lines):
                        detail_line = lines[j].strip()

                company = ""
                location = ""
                salary = ""
                posted_date = ""
                job_type = ""

                parts = re.split(r"\s*[•·]\s*", detail_line)
                if len(parts) >= 1:
                    company = parts[0].strip()

                if len(parts) >= 2:
                    loc_raw = parts[1].strip()
                    # Location patterns: "Remote only", "Onsite or remote", "In office", city names
                    if loc_raw.lower() in (
                        "remote only",
                        "onsite or remote",
                        "in office",
                        "hybrid",
                    ):
                        job_type = loc_raw
                        if len(parts) >= 3:
                            location = parts[2].strip()
                            # Check for "+N more" suffix
                            location = re.sub(r"\s*\+?\d+\s*more$", "", location).strip()
                    else:
                        location = loc_raw
                        location = re.sub(r"\s*\+?\d+\s*more$", "", location).strip()

                # Extract salary
                salary_parts = []
                for part in parts:
                    p = part.strip()
                    if re.match(r"^\$[\d,.]+k?\s*–?\s*\$?[\d,.k]*", p):
                        salary_parts.append(p)
                if salary_parts:
                    salary = " • ".join(salary_parts)

                # Extract date
                for part in parts:
                    p = part.strip().lower()
                    if p in ("today", "yesterday") or "ago" in p:
                        posted_date = _parse_date(part.strip())
                        break

                # Location filter
                location_matched = True
                if search_location:
                    search_loc_lower = search_location.lower()
                    job_loc_lower = location.lower()
                    job_type_lower = job_type.lower()
                    
                    is_local = search_loc_lower in job_loc_lower
                    is_remote = "remote" in job_loc_lower or "everywhere" in job_loc_lower or "remote" in job_type_lower
                    if not (is_local or is_remote):
                        location_matched = False

                if location_matched:
                    jobs.append(
                        JobListing(
                            title=title,
                            company=company,
                            location=location,
                            platform="Wellfound",
                            url=url,
                            posted_date=posted_date,
                            description="",
                            salary=salary,
                            job_type=job_type,
                        )
                    )

        i += 1

    return jobs


def _parse_date(date_str: str) -> str:
    import time

    now = time.time()
    lower = date_str.lower().strip()
    if lower == "today":
        return time.strftime("%Y-%m-%d", time.gmtime(now))
    if lower == "yesterday":
        return time.strftime("%Y-%m-%d", time.gmtime(now - 86400))
    match = re.search(r"(\d+)\s+day", lower)
    if match:
        days = int(match.group(1))
        return time.strftime("%Y-%m-%d", time.gmtime(now - days * 86400))
    return date_str
