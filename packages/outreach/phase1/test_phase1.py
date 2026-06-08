import os
import json
import sys
from dotenv import load_dotenv

def test_phase1():
    # Set the working directory to the file's parent folder
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    print("=" * 50)
    print("   PHASE 1 VERIFICATION RUNNER")
    print("=" * 50)
    
    # 1. Verify existence of required config files
    files = ["contacts.json", "requirements.txt", ".env.example", ".env"]
    all_files_exist = True
    for file in files:
        if os.path.exists(file):
            print(f"[PASS] File exists: {file}")
        else:
            print(f"[FAIL] File missing: {file}")
            all_files_exist = False
            
    if not all_files_exist:
        print("\nPhase 1 verification failed: Missing required files.")
        sys.exit(1)

    # 2. Verify contacts database parsing and structure
    try:
        with open("contacts.json", "r", encoding="utf-8") as f:
            contacts = json.load(f)
        
        if len(contacts) < 3:
            print("[FAIL] contacts.json must contain at least 3 target records.")
            sys.exit(1)
            
        for idx, entry in enumerate(contacts, 1):
            required_keys = ["recipient_email", "company", "role", "candidate_name", "candidate_background"]
            for key in required_keys:
                if key not in entry or not entry[key]:
                    print(f"[FAIL] Target {idx} is missing required field: '{key}'")
                    sys.exit(1)
            print(f"[PASS] Target {idx} ({entry['company']}) schema parsed successfully.")
            
    except Exception as e:
        print(f"[FAIL] Error parsing contacts.json: {e}")
        sys.exit(1)

    # 3. Verify .env load and dry-run defaults
    try:
        load_dotenv()
        dry_run = os.getenv("DRY_RUN")
        if dry_run is None:
            print("[FAIL] DRY_RUN setting not found in environment. Load failed.")
            sys.exit(1)
        print(f"[PASS] Environment loaded successfully. DRY_RUN={dry_run}")
    except Exception as e:
        print(f"[FAIL] Environment load exception: {e}")
        sys.exit(1)

    print("=" * 50)
    print("PHASE 1 EVALUATION STATUS: ALL PASSED")
    print("=" * 50)

if __name__ == "__main__":
    test_phase1()
