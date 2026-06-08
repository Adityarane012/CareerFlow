# 🚀 Job Agent

A high-performance, concurrent CLI-based **Job Agent** designed to aggregate, clean, and deduplicate job listings from three premier sources: **Naukri.com**, **RemoteOK**, and **Wellfound** (formerly AngelList).

---

## ✨ Features

- **Concurrent Multi-Threaded Scrapers**: Spawns concurrent background threads using `ThreadPoolExecutor` to scrape Naukri, RemoteOK, and Wellfound in parallel, reducing extraction time by up to 70%.
- **Lossless Emoji & Mojibake Parsing**: Reconstructs double-encoded Unicode characters back to raw bytes using a mathematically-correct character-to-byte CP1252 re-encoder, restoring complex zero-width-joined emojis (e.g., `✨👩‍💻`) and special characters seamlessly.
- **Line-Restricted Truncated HTML Stripping**: Reorders tag-processing steps to cleanly strip trailing incomplete HTML tags (e.g., `<span cl` or `<stron`) truncated by remote servers while safely preserving valid math symbols like `<2 years`.
- **Intelligent Deduplication**: Filters out platform-level spam (such as duplicate entries posted under different internal IDs on the same platform), saving a clean, unique dataset to a CSV file.
- **Flexible UI Launcher**: Supports command-line arguments as well as a fallback interactive menu prompt when launched without inputs, displaying a gorgeous console aggregation summary upon completion.

---

## 📂 Output CSV Format

Aggregated jobs are saved in a clean, standardized format:

`title,company,location,url,source,date_posted,scraped_at`

| Column | Description |
|---|---|
| **title** | Job title / position |
| **company** | Hiring company name |
| **location** | Job location (city/state/remote) |
| **url** | Exact URL link to apply / view the listing |
| **source** | Source platform (Naukri, RemoteOK, or Wellfound) |
| **date_posted** | ISO timestamp or relative date when the job was posted |
| **scraped_at** | The exact date and time the record was aggregated (`%Y-%m-%d %H:%M:%S`) |

---

## 🛠️ Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/job-agent.git
   cd job-agent
   ```

2. **Set up Virtual Environment**:
   ```bash
   python -m venv .venv
   # On Windows:
   .venv\Scripts\activate
   # On macOS/Linux:
   source .venv/bin/activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables**:
   Copy `.env.example` to `.env` and enter your Firecrawl API key (required for Wellfound):
   ```bash
   cp .env.example .env
   ```

---

## 🚀 How to Run

The Job Agent can be executed in two different ways:

### 1. Interactive Mode (No Arguments)
Just run `main.py` directly. The console launcher will prompt you for inputs:
```bash
python main.py
```
*Prompt Example:*
`Enter job title/role (e.g., 'software engineer in mumbai'): software engineer`

### 2. CLI Mode (With Arguments)
Pass your query directly as a positional argument. You can filter by platform (`--source` / `-s`) and specify a custom output path (`--output` / `-o`):
```bash
# Search for software engineer in Mumbai on Naukri only and save to a custom CSV:
python main.py "software engineer in mumbai" -s naukri -o data/mumbai_jobs.csv

# Search for python developer roles across all 3 platforms:
python main.py "python developer" --source all
```

---

## 🧪 Testing

We have built a comprehensive suite of unit and integration tests.

### Run Unit Tests
Verifies query parsing, HTML text cleaning, and CP1252 emoji mojibake recovery logic:
```bash
python -m unittest tests/test_job_agent.py
```

### Run Integration Tests
Scrapes listings across all three boards, saves them to a temporary file, and parses schema headers:
```bash
python main.py "software engineer" --output data/jobs.csv --source all
python tests/verify_csv.py
```
