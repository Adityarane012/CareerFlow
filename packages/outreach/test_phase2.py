import os
import sys
from dotenv import load_dotenv
from email_generator import generate_email, generate_deterministic_email

def test_phase2():
    load_dotenv()
    print("=" * 50)
    print("   PHASE 2 VERIFICATION RUNNER")
    print("=" * 50)
    
    test_contact = {
        "recipient_name": "David Miller",
        "recipient_email": "david.miller@techflow.io",
        "company": "TechFlow Systems",
        "role": "Software Engineer (Python/Django)",
        "personalization_note": "read your recent technical blog post on optimizing PostgreSQL query latency in high-scale Django apps",
        "candidate_name": "Aditya Rane",
        "candidate_background": "Python developer skilled in relational databases, Django, and API optimization",
        "portfolio_url": "https://github.com/adityarane"
    }

    # 1. Test deterministic template generator
    print("Testing deterministic template generator...")
    subj_temp, body_temp = generate_deterministic_email(test_contact)
    assert "Software Engineer" in subj_temp, "Deterministic subject missing role"
    assert "TechFlow Systems" in body_temp, "Deterministic body missing company name"
    assert "David Miller" in body_temp, "Deterministic body missing recipient name"
    word_count_temp = len(body_temp.split())
    assert word_count_temp < 150, f"Deterministic body too long: {word_count_temp} words"
    print(f"[PASS] Deterministic template generation passes constraints ({word_count_temp} words).")
    
    # 2. Test Groq-powered generator (if key exists)
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        print("\nTesting Groq-powered LLM generator...")
        try:
            subj_groq, body_groq = generate_email(test_contact)
            print("-" * 40)
            print(f"Subject: {subj_groq}")
            print(f"Body:\n{body_groq}")
            print("-" * 40)
            
            assert subj_groq, "Groq generated subject is empty"
            assert body_groq, "Groq generated body is empty"
            word_count_groq = len(body_groq.split())
            assert word_count_groq < 150, f"Groq body too long: {word_count_groq} words"
            print(f"[PASS] Groq generator successfully generated a personalized email ({word_count_groq} words).")
        except Exception as e:
            print(f"[FAIL] Groq generator exception: {e}")
            sys.exit(1)
    else:
        print("\n[NOTE] GROQ_API_KEY is not configured. Skipping Groq generator test.")
        
    print("=" * 50)
    print("PHASE 2 EVALUATION STATUS: ALL PASSED")
    print("=" * 50)

if __name__ == "__main__":
    test_phase2()
