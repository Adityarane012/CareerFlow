import re
import concurrent.futures
from datetime import datetime

from src.models.job_listing import JobListing
from src.scrapers.naukri import fetch_naukri_jobs
from src.scrapers.remote_ok import fetch_remoteok_jobs
from src.scrapers.wellfound import fetch_wellfound_jobs
from src.utils.cli import parse_args
from src.utils.csv_writer import save_jobs_to_csv
from src.utils.query_parser import parse_query


def main() -> None:
    args = parse_args()

    title = args.title
    if not title:
        print("\n=== Job Agent Launcher ===")
        title = input("Enter job title/role (e.g., 'software engineer in mumbai'): ").strip()
        if not title:
            print("[Error] Job title/role cannot be empty.")
            return

    role, location = parse_query(title)

    if location:
        print(f"\n[Job Agent] Query parsed: role='{role}' | location='{location}'")
    else:
        print(f"\n[Job Agent] Query parsed: role='{role}' | location=<any>")

    if not args.output:
        sanitized = re.sub(r"[^a-zA-Z0-9_-]+", "_", title.strip().lower()).strip("_")
        if not sanitized:
            sanitized = "query"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        source_prefix = f"{args.source}_" if args.source != "all" else ""
        output_file = f"data/jobs_{source_prefix}{sanitized}_{timestamp}.csv"
    else:
        output_file = args.output

    print(f"[Job Agent] Output CSV: {output_file}")

    jobs: list[JobListing] = []
    source_to_fetch = args.source.lower()

    futures_map = {}
    print("\n[Job Agent] Spawning scraper threads in parallel...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        if source_to_fetch in ("remoteok", "all"):
            futures_map[executor.submit(fetch_remoteok_jobs, role, location)] = "RemoteOK"
        if source_to_fetch in ("naukri", "all"):
            futures_map[executor.submit(fetch_naukri_jobs, role, location)] = "Naukri"
        if source_to_fetch in ("wellfound", "all"):
            futures_map[executor.submit(fetch_wellfound_jobs, role, location)] = "Wellfound"

        results_summary = {}
        for future in concurrent.futures.as_completed(futures_map):
            source = futures_map[future]
            try:
                res = future.result()
                jobs.extend(res)
                results_summary[source] = {"count": len(res), "status": "Success"}
                print(f"[Job Agent] -> {source} finished: successfully retrieved {len(res)} job(s)")
            except Exception as e:
                results_summary[source] = {"count": 0, "status": "Failed"}
                print(f"[Job Agent] [ERROR] Scraper {source} failed: {e}")

    # Deduplicate aggregated listings based on title, company, platform, and location
    seen_keys = set()
    unique_jobs = []
    for job in jobs:
        key = (job.title.lower(), job.company.lower(), job.platform.lower(), job.location.lower())
        if key not in seen_keys:
            seen_keys.add(key)
            unique_jobs.append(job)

    if not unique_jobs:
        print("\n[Job Agent] No jobs found across any platform.")
    else:
        save_jobs_to_csv(unique_jobs, output_file)

    # Display final execution summary to user
    print("\n" + "="*45)
    print("             AGGREGATION SUMMARY             ")
    print("="*45)
    print(f"Role:     {role}")
    print(f"Location: {location or '<any>'}")
    print(f"Output:   {output_file}")
    print("-" * 45)
    print(f"{'Platform':<15} | {'Status':<10} | {'Jobs Found':<10}")
    print("-" * 45)
    
    # Ensure all attempted platforms are shown in summary
    for platform in ["Naukri", "RemoteOK", "Wellfound"]:
        if source_to_fetch == "all" or source_to_fetch == platform.lower():
            info = results_summary.get(platform, {"count": 0, "status": "Skipped"})
            print(f"{platform:<15} | {info['status']:<10} | {info['count']:<10}")
            
    print("-" * 45)
    print(f"Total Unique Jobs Saved: {len(unique_jobs)}")
    print("="*45 + "\n")


if __name__ == "__main__":
    main()
