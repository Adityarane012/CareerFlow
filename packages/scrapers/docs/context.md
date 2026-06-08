# Job Agent - Context & Scope

## What We're Building

A **Job Agent** that aggregates job listings from three platforms — **Naukri.com**, **RemoteOK**, and **Wellfound** (formerly AngelList) — for relevant job titles and stores the results in a unified, clean, and deduplicated CSV file.

## Problem Statement & Solutions

Job seekers need to visit multiple job boards, search each one with the same query, and manually collate results. This tool automates this process recursively, normalizes, cleans, and deduplicates listings concurrently.

### Technical Challenges Solved
1. **Lossless Emoji & Mojibake Recovery**:
   * *Problem*: The RemoteOK API returns double-encoded characters where UTF-8 bytes were decoded under CP1252/Latin-1 prior to JSON serialization. Standard codecs crash on CP1252 control character gaps (e.g. `0x8D`) or Latin-1 symbol gaps (e.g. `0x80`).
   * *Solution*: Re-mapped double-encoded Unicode points back to raw byte numbers via a CP1252-to-byte mapping and then decoded the byte sequence using UTF-8 with replacement fallbacks. This cleanly recovers complex zero-width-joined emojis (such as `✨👩‍💻👨‍💻`), smart quotes (`’`), and em-dashes (`–`).
2. **Broken & Truncated HTML Tag Stripping**:
   * *Problem*: Servers character-truncate descriptions before appending applicant messages, cutting directly through active tags and producing invalid snippets like `<span cl<br/>` or `<stron<br/>`.
   * *Solution*: Converted all line-breaking HTML block elements (like `<br/>` or `<p>`) to standard newlines *before* performing an incomplete-tag cleanup. Used a restricted single-line tag lookahead regex (`re.sub(r'<[a-zA-Z]+[^>\n]*?(?=\n|$)', '', text)`) to completely strip truncated tag remnants while safely preserving mathematical less-than signs (e.g. `<2 years`).

---

## Agent Capabilities

1. **Accepts Direct Inputs**: Parses the job role and the location from the user raw query (e.g. `"software engineer in mumbai"`).
2. **Interactive Fallback**: If launched without arguments (`python main.py`), prompts the user interactively in the terminal for the job query.
3. **Parallel Scrapers**: Spawns concurrent scraper worker threads using Python's `concurrent.futures.ThreadPoolExecutor` to query Naukri, RemoteOK, and Wellfound in parallel:
   - **Naukri.com** — Internal API queries using a dynamically generated `nkparam` RSA-encrypted token.
   - **RemoteOK** — Tag-filtered public API endpoint with client-side location filtering.
   - **Wellfound** — Structured web scraping using stealth-mode Firecrawl.
4. **Smart Deduplication**: Aggregates all listings and removes redundant listings (such as identical postings spammed under different internal IDs on the same platform) based on title, company, platform, and location.
5. **Execution Summary**: Renders a premium visual table in the console detailing the execution status and unique listing counts for each platform.

---

## Output CSV Format

Aggregated listings are saved to dynamically timestamped CSV files (or a fixed path using `-o` / `--output`) containing the following headers:

| Column      | Description                                 |
|-------------|---------------------------------------------|
| title       | Job title                                   |
| company     | Company name                                |
| location    | Job location                                |
| url         | Link to the job listing                     |
| source      | Source platform (Naukri/RemoteOK/Wellfound) |
| date_posted | Date the job was posted                     |
| scraped_at  | Timestamp when the job was aggregated       |

---

## Technology Stack

- **Core**: Python 3.13
- **Scraping & APIs**: `requests`, `pycryptodome` (for Naukri RSA token signature generation), `firecrawl-py` (for Wellfound scraping)
- **Concurrency**: `concurrent.futures` (ThreadPoolExecutor thread pooling)
- **Testing**: `unittest` test suite verifying query parsing, HTML cleaning, and CP1252 recovery

---

## Non-Goals

- No web UI — CLI-only tool (for now).
- No automatic scheduling / cron — manual invocation only.
- No permanent storage / database — flat CSV output only.
