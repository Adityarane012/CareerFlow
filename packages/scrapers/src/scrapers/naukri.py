import time
import base64

import requests
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5

from src.models.job_listing import JobListing
from src.utils.text_cleaner import clean_html

API_URL = "https://www.naukri.com/jobapi/v3/search"
BASE_JD_URL = "https://www.naukri.com"

NAUKRI_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALrlQ+djR0RjJwBF1xuisHmdFv334MIm
K6LgzJhmLhN7B5yuEyaKoasgXQk3+OQglsOaBxEJ0j5PcTL3nbOvt80CAwEAAQ==
-----END PUBLIC KEY-----"""


def _generate_nkparam(page_type: str = "srp") -> str:
    key = RSA.import_key(NAUKRI_PUBLIC_KEY)
    cipher = PKCS1_v1_5.new(key)
    timestamp = int(time.time() * 1000)
    plaintext = f"v0|{timestamp}|121_{page_type}"
    encrypted = cipher.encrypt(plaintext.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")


def _parse_salary(label: str) -> str:
    label = label.strip()
    if not label or label.lower() == "not disclosed":
        return ""
    return label


def _parse_posted_date(label: str) -> str:
    if not label:
        return ""
    lower = label.lower()
    now = time.time()

    if "today" in lower or "just now" in lower or "few hours" in lower:
        return time.strftime("%Y-%m-%d", time.gmtime(now))

    if "yesterday" in lower:
        return time.strftime("%Y-%m-%d", time.gmtime(now - 86400))

    import re
    match = re.search(r"(\d+)\s*day", lower)
    if match:
        days = int(match.group(1))
        return time.strftime("%Y-%m-%d", time.gmtime(now - days * 86400))

    match = re.search(r"(\d+)\s*month", lower)
    if match:
        months = int(match.group(1))
        return time.strftime("%Y-%m-%d", time.gmtime(now - months * 30 * 86400))

    return label


def fetch_naukri_jobs(query: str, location: str = "", max_pages: int = 1) -> list[JobListing]:
    nkparam = _generate_nkparam()

    headers = {
        "authority": "www.naukri.com",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "upgrade-insecure-requests": "1",
        "appid": "109",
        "systemid": "Naukri",
        "Nkparam": nkparam,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.naukri.com/",
    }

    all_jobs: list[JobListing] = []
    seen_ids: set[str] = set()

    for page in range(1, max_pages + 1):
        params = {
            "noOfResults": "20",
            "pageNo": str(page),
            "keyword": query,
            "urlType": "search_by_keyword",
            "searchType": "adv",
            "k": query,
        }
        if location:
            params["location"] = location

        try:
            resp = requests.get(API_URL, headers=headers, params=params, timeout=15)
            if resp.status_code != 200:
                print(f"[Naukri] API returned status {resp.status_code} on page {page}")
                break

            data = resp.json()
            job_details = data.get("jobDetails", [])
            if not job_details:
                break

            for item in job_details:
                job_id = item.get("jobId")
                if not job_id or job_id in seen_ids:
                    continue
                seen_ids.add(job_id)

                title = item.get("title", "").strip()
                company = item.get("companyName", "").strip()

                placeholders = item.get("placeholders", [])
                location = ""
                salary = ""
                experience = ""
                for ph in placeholders:
                    ph_type = ph.get("type", "")
                    ph_label = ph.get("label", "")
                    if ph_type == "location":
                        location = ph_label.strip()
                    elif ph_type == "salary":
                        salary = _parse_salary(ph_label)
                    elif ph_type == "experience":
                        experience = ph_label.strip()

                posted_raw = item.get("footerPlaceholderLabel", "")
                posted_date = _parse_posted_date(posted_raw)

                jd_url = item.get("jdURL", "")
                full_url = f"{BASE_JD_URL}{jd_url}" if jd_url else ""

                description = clean_html(item.get("jobDescription", ""))

                skills_raw = item.get("tagsAndSkills", "")
                if skills_raw:
                    skills_list = [s.strip() for s in skills_raw.split(",") if s.strip()]
                    if not description:
                        description = ", ".join(skills_list)

                job = JobListing(
                    title=title,
                    company=company,
                    location=location,
                    platform="Naukri",
                    url=full_url,
                    posted_date=posted_date,
                    description=description,
                    salary=salary,
                    job_type=experience,
                )
                all_jobs.append(job)

            if int(params["pageNo"]) * 20 >= data.get("noOfJobs", 0):
                break

        except requests.RequestException as e:
            print(f"[Naukri] Request failed on page {page}: {e}")
            break
        except ValueError as e:
            print(f"[Naukri] JSON parse failed on page {page}: {e}")
            break

    return all_jobs
