import html
import re

CP1252_MAP = {
    0x20AC: 0x80, # €
    0x201A: 0x82, # ‚
    0x0192: 0x83, # ƒ
    0x201E: 0x84, # „
    0x2026: 0x85, # …
    0x2020: 0x86, # †
    0x2021: 0x87, # ‡
    0x02C6: 0x88, # ˆ
    0x2030: 0x89, # ‰
    0x0160: 0x8A, # Š
    0x2039: 0x8B, # ‹
    0x0152: 0x8C, # Œ
    0x017D: 0x8E, # Ž
    0x2018: 0x91, # ‘
    0x2019: 0x92, # ’
    0x201C: 0x93, # “
    0x201D: 0x94, # ”
    0x2022: 0x95, # •
    0x2013: 0x96, # –
    0x2014: 0x97, # —
    0x02DC: 0x98, # ˜
    0x2122: 0x99, # ™
    0x0161: 0x9A, # š
    0x203A: 0x9B, # ›
    0x0153: 0x9C, # œ
    0x017E: 0x9E, # ž
    0x0178: 0x9F, # Ÿ
}

def clean_html(text: str) -> str:
    if not text:
        return ""

    # Normalize carriage returns early so they don't interfere with tag parsing/lookaheads
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    # Fix any mojibake (double-encoded UTF-8 interpreted as cp1252/latin-1)
    try:
        b_list = []
        for char in text:
            cp = ord(char)
            if cp in CP1252_MAP:
                b_list.append(CP1252_MAP[cp])
            elif cp <= 255:
                b_list.append(cp)
            else:
                b_list.extend(char.encode('utf-8'))
        text = bytes(b_list).decode('utf-8', errors='replace')
    except Exception:
        # Fallback to standard replacements if something fails
        replacements = {
            "â€™": "'",
            "â€“": "–",
            "â€”": "—",
            "â€œ": '"',
            "â€ ": '"',
            "â€¢": "•",
            "â€¦": "…",
            "â„¢": "™",
            "â€˜": "'",
            "Â": "",
        }
        for corrupted, fixed in replacements.items():
            text = text.replace(corrupted, fixed)

    # 1. Unescape HTML entities (handling potential double-escaped entities like &amp;amp;)
    prev = ""
    while text != prev:
        prev = text
        text = html.unescape(text)

    # 2. Replace non-breaking spaces with standard space
    text = text.replace("&nbsp;", " ").replace("\xa0", " ")

    # 3. Replace common line-breaking/structural tags with spaces or newlines
    # e.g., <br>, <br/>, <p>, <li>, <div>, <tr>, etc.
    text = re.sub(r'<(br|p|div|li|tr|h[1-6])[^>]*>', '\n', text)

    # 4. Clean trailing open HTML tags before a newline or end of string (like <span cl or <stron)
    # This is safe and preserves mathematical symbols like '<2'
    text = re.sub(r'<[a-zA-Z]+[^>\n]*?(?=\n|$)', '', text)

    # 5. Strip all other HTML tags
    text = re.sub(r'<[^>]*>', '', text)

    # 6. Strip anti-spam verification footer blocks (e.g. RemoteOK verification text)
    text = re.sub(r'(?i)Please mention the word \*\*.*?\*\* and tag .*? when applying to show you read the job post completely.*?(?:avoid spam applicants.*?see they\'re human\.?|$)', '', text)

    # 7. Clean up consecutive whitespace and newlines
    text = re.sub(r'\n\s*\n+', '\n', text)  # Collapse multiple newlines
    text = re.sub(r'[ \t]+', ' ', text)      # Collapse multiple spaces/tabs

    return text.strip()

