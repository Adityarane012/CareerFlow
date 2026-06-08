# Evaluation Guide (eval.md)

This evaluation checklist defines verification tests for each implementation phase of **The Closer**. Use this to check correctness before transitioning to the next phase.

---

## Phase 1: Inputs & Configuration Evaluation

### Goal
Ensure environment settings and structured contact data are parsed cleanly.

### Checkpoints
- [ ] **`contacts.json` Validation**: Run a JSON syntax validator to confirm no comma or quote errors exist.
- [ ] **Optional/Critical Fields Presence**: Verify `recipient_email`, `company`, `role`, and `candidate_name` are defined for all targets.
- [ ] **`.env` Loading**: Test that calling `load_dotenv()` populates `os.environ` correctly.

### Run Verification Test
Run this validation check in the Python shell:
```python
import json
with open("contacts.json", "r", encoding="utf-8") as f:
    data = json.load(f)
assert len(data) >= 3, "Should contain at least 3 outreach records."
for index, item in enumerate(data):
    assert "recipient_email" in item, f"Record {index} missing recipient_email"
    assert "company" in item, f"Record {index} missing company"
    assert "role" in item, f"Record {index} missing role"
print("Phase 1 Check: PASSED")
```

---

## Phase 2: Email Generator Evaluation

### Goal
Ensure personalized templates are formatted correctly and comply with the constraints.

### Checkpoints
- [ ] **Template Output Formatting**: Ensure the deterministic template interpolates all variables correctly.
- [ ] **Constraint Check**: Word count must be under 150 words.
- [ ] **Single CTA Verification**: Ensure only one question/call-to-action is written.
- [ ] **Groq Fallback Test**: Disable internet connection or configure an invalid API key, and check if the module falls back gracefully to template mode.

### Run Verification Test
Run this generator test in the Python shell:
```python
from email_generator import generate_deterministic_email
test_contact = {
    "recipient_name": "Test Manager",
    "recipient_email": "test@company.com",
    "company": "TestCorp",
    "role": "QA Engineer",
    "personalization_note": "saw your team's test automation suite",
    "candidate_name": "Aditya Rane",
    "candidate_background": "Python QA developer",
    "portfolio_url": "https://github.com/aditya"
}
subject, body = generate_deterministic_email(test_contact)
assert "QA Engineer" in subject, "Subject missing role"
assert "TestCorp" in body, "Body missing company name"
assert "Test Manager" in body, "Body missing recipient name"
word_count = len(body.split())
assert word_count < 150, f"Body is too long: {word_count} words"
print("Phase 2 Check: PASSED")
```

---

## Phase 3: Logging Infrastructure Evaluation

### Goal
Ensure the logging output registers occurrences accurately.

### Checkpoints
- [ ] **Headers Match Requirements**: Verify header columns are: `timestamp`, `recipient_email`, `company`, `role`, `subject`, `status`, `error_message`.
- [ ] **File Lifecycle Handling**: Verify the file is created if missing, and appended to if it exists.
- [ ] **Formatting Checks**: Verify columns align correctly (e.g. subjects containing commas do not break columns).

### Run Verification Test
Run this logging test in the Python shell:
```python
import os
import csv
from logger import log_outreach

# Delete prior log for clean state
if os.path.exists("outreach_log.csv"):
    os.remove("outreach_log.csv")

log_outreach("test@mail.com", "TestCo", "Developer", "Subj, test", "sent", "")
assert os.path.exists("outreach_log.csv"), "outreach_log.csv was not created"

with open("outreach_log.csv", mode="r", newline="", encoding="utf-8") as f:
    reader = list(csv.reader(f))
    assert len(reader) == 2, "Log should contain header and one data row"
    assert reader[0] == ["timestamp", "recipient_email", "company", "role", "subject", "status", "error_message"], "Headers mismatch"
    assert reader[1][1] == "test@mail.com", "Email data column mismatch"
    assert reader[1][4] == "Subj, test", "Comma in subject was not escaped correctly"

print("Phase 3 Check: PASSED")
```

---

## Phase 4: Delivery Subsystem Evaluation

### Goal
Ensure the delivery logic does not leak credentials or send mails in Dry-Run mode.

### Checkpoints
- [ ] **Dry-Run Enforcement**: In `DRY_RUN=true`, verify no TCP connection is attempted for SMTP or IMAP.
- [ ] **Status Code Outputs**: Confirm `send_email_smtp` returns `("dry_run", None)` when in Dry-Run mode.
- [ ] **Error Propagation**: Test with a fake host to check if exceptions return as `("failed", [error details])`.

---

## Phase 5: CLI Orchestrator Evaluation

### Goal
Verify the central application manages targets, previews, and prompt logic properly.

### Checkpoints
- [ ] **Ansi Styling Verification**: Check that CLI colors render beautifully on screen.
- [ ] **Command Options Input Loop**: Verify the console loops until valid inputs (`s`, `d`, `k`, `q`) are entered.
- [ ] **Early Interruption**: Ensure typing `q` gracefully aborts execution.
