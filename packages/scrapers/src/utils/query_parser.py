import re


def parse_query(raw: str) -> tuple[str, str]:
    query = raw.strip().lower()

    # Remove leading action words
    query = re.sub(
        r"^(find|search|show\s+me|get|fetch|look(?:ing)?\s*(?:for)?|i\s+want|i\s+need|give\s+me)\s+",
        "",
        query,
    )

    # Extract location after "in"
    location = ""
    loc_match = re.search(r"\s+in\s+(.+)$", query)
    if loc_match:
        location = loc_match.group(1).strip()
        query = query[: loc_match.start()].strip()

    # Remove trailing filler words
    query = re.sub(
        r"\s+(roles?|jobs?|positions?|openings?|listings?|opportunities?|vacancies?)\s*$",
        "",
        query,
    )

    # Clean up extra spaces
    query = re.sub(r"\s+", " ", query).strip()

    return query, location
