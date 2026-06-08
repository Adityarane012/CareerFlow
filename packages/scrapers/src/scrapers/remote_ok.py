from typing import Any

import requests

from src.models.job_listing import JobListing
from src.utils.text_cleaner import clean_html

API_URL = "https://remoteok.com/api"
BASE_URL = "https://remoteok.com/remote-jobs"


def fetch_remoteok_jobs(query: str, location: str = "") -> list[JobListing]:
    query_lower = query.lower()
    query_words = [w.strip() for w in query_lower.split() if w.strip()]

    # RemoteOK API supports filtering by tag. We pass the first word or most specific tag.
    params = {}
    if query_words:
        common_tags = {"python", "javascript", "react", "golang", "go", "ruby", "node", "typescript"}
        tag_to_use = query_words[0]
        for w in query_words:
            if w in common_tags:
                tag_to_use = w
                break
        params["tag"] = tag_to_use

    try:
        resp = requests.get(API_URL, headers={"User-Agent": "Mozilla/5.0"}, params=params, timeout=15)
        resp.raise_for_status()
        resp.encoding = 'utf-8'
        data: list[dict[str, Any]] = resp.json()
    except requests.RequestException as e:
        print(f"[RemoteOK] API request failed: {e}")
        return []

    if not data or not isinstance(data, list):
        return []

    results: list[JobListing] = []

    # data[0] is metadata; actual jobs start at index 1
    for item in data[1:]:
        position = item.get("position", "")
        if not position:
            continue

        position_lower = position.lower()
        tags = [t.lower() for t in item.get("tags", [])]

        # Smart query matching:
        # Check if all query words are found in the position title or as tags (synonym-aware for developer/engineer)
        matched = True
        for word in query_words:
            synonyms = [word]
            if word == "developer":
                synonyms.extend(["engineer", "dev", "programmer"])
            elif word == "engineer":
                synonyms.extend(["developer", "dev", "programmer"])

            word_matched = False
            for syn in synonyms:
                if syn in position_lower or any(syn in tag for tag in tags):
                    word_matched = True
                    break
            if not word_matched:
                matched = False
                break

        if not matched:
            continue

        slug = item.get("slug", "")
        url = item.get("url") or f"{BASE_URL}/{slug}" if slug else ""

        salary_parts = []
        if item.get("salary_min"):
            salary_parts.append(f"${item['salary_min']:,.0f}")
        if item.get("salary_max"):
            salary_parts.append(f"${item['salary_max']:,.0f}")
        salary = " - ".join(salary_parts) if salary_parts else ""

        location = item.get("location") or ""

        job = JobListing(
            title=position.strip(),
            company=item.get("company", "").strip(),
            location=location.strip().rstrip(",").strip(),
            platform="RemoteOK",
            url=url,
            posted_date=item.get("date", ""),
            description=clean_html(item.get("description", "")),
            salary=salary,
            job_type="Remote",
        )
        results.append(job)

    return results
