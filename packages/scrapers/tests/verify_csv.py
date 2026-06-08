import csv
import sys
from collections import Counter
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

with open("data/jobs.csv", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f"Headers: {reader.fieldnames}")
print(f"Total rows: {len(rows)}")
source_counts = Counter(r["source"] for r in rows)
for s, c in source_counts.most_common():
    print(f"  {s}: {c} jobs")

for i, r in enumerate(rows[:5]):
    loc = r["location"].encode("utf-8", errors="replace").decode("utf-8", errors="replace")
    print(f"\n--- Job {i+1} ---")
    print(f"  Title:      {r['title']}")
    print(f"  Company:    {r['company']}")
    print(f"  Location:   {loc}")
    print(f"  Source:     {r['source']}")
    print(f"  Date Posted: {r['date_posted']}")
    print(f"  Scraped At: {r['scraped_at']}")
    print(f"  URL:        {r['url'][:80]}...")
if len(rows) > 5:
    print(f"\n... and {len(rows) - 5} more jobs")
