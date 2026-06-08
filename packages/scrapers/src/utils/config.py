import os
from pathlib import Path

from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(ENV_PATH)


def get_firecrawl_api_key() -> str:
    key = os.getenv("FIRECRAWL_API_KEY", "")
    if not key or key == "your_firecrawl_api_key_here":
        print("[Config] WARNING: FIRECRAWL_API_KEY is not set in .env")
        print("[Config] Wellfound scraper will be skipped.")
        return ""
    return key
