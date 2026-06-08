import os
import json
import logging

# Configure logger for module diagnostics
logger = logging.getLogger("the_closer.email_generator")

def generate_email(contact_record):
    """
    Generates a personalized cold email subject and body.
    Attempts to use Groq LLM rewriting if configured; falls back to deterministic template.
    """
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        try:
            from groq import Groq
            client = Groq(api_key=groq_key)
            model_name = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
            
            prompt = f"""
You are a professional cold outreach copywriter. Write a highly personalized, professional, and natural-sounding cold email for a job opportunity based on the details below:

Recipient Name: {contact_record.get('recipient_name', 'Hiring Manager')}
Recipient Email: {contact_record.get('recipient_email')}
Company Name: {contact_record.get('company')}
Role Title: {contact_record.get('role')}
Job Posting URL: {contact_record.get('job_url', 'N/A')}
Personalization Hook Info: {contact_record.get('personalization_note', '')}
Candidate Name: {contact_record.get('candidate_name')}
Candidate Background: {contact_record.get('candidate_background')}
Portfolio/GitHub/LinkedIn Link: {contact_record.get('portfolio_url', '')}

Constraints & Rules:
1. Strict Word Limit: The entire email body must be under 150 words.
2. Subject Line: Keep it short, relevant, and descriptive (no spam clickbait).
3. Hook: Incorporate the Personalization Hook Info naturally in the first 1-2 sentences.
4. Fit: Connect the Candidate Background to the Role Title concisely.
5. CTA (Call To Action): Include exactly ONE clear, low-friction request (e.g., asking for a short chat, a referral, or direction to the correct hiring contact).
6. Authenticity: Avoid exaggerated claims, flattery, or making up connections/experience.

You MUST respond ONLY with a JSON object containing these exact keys:
"subject": "The generated email subject line"
"body": "The generated email body text (use single newlines for spacing)"
"""
            # Request chat completion from Groq
            # Groq supports response_format={"type": "json_object"}
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                model=model_name,
                response_format={"type": "json_object"}
            )
            
            content = chat_completion.choices[0].message.content
            email_data = json.loads(content)
            subject = email_data.get("subject")
            body = email_data.get("body")
            
            if subject and body:
                logger.info(f"Successfully generated email using Groq ({model_name}) for {contact_record.get('company')}")
                return subject.strip(), body.strip()
            
        except Exception as e:
            logger.warning(f"Failed generating email with Groq API: {e}. Falling back to template.")
            
    # Deterministic fallback template
    return generate_deterministic_email(contact_record)

def generate_deterministic_email(contact_record):
    """
    Generates an outreach email using a pre-defined pythonic string template.
    """
    role = contact_record.get("role", "Software Engineer")
    company = contact_record.get("company", "your company")
    recipient_name = contact_record.get("recipient_name", "Hiring Team")
    personalization_note = contact_record.get("personalization_note", "")
    candidate_name = contact_record.get("candidate_name", "Candidate")
    candidate_background = contact_record.get("candidate_background", "Python developer")
    portfolio_url = contact_record.get("portfolio_url", "")
    
    subject = f"Outreach: {role} opportunity at {company}"
    
    # Construct personalization hook line
    if personalization_note:
        hook = f"I noticed that {company} is hiring for the {role} role, and I {personalization_note}."
    else:
        hook = f"I noticed that {company} is hiring for the {role} role."
        
    portfolio_line = f"\n\nYou can review my projects and portfolio here: {portfolio_url}" if portfolio_url else ""
    
    body = f"""Hi {recipient_name},

{hook}

I'm {candidate_name}, a {candidate_background}. I wanted to reach out because the work your team is doing aligns perfectly with my background in software building and automation.

Would you be open to a brief 10-minute chat next week to discuss how my skill set might fit the needs of this role, or point me in the right direction?{portfolio_line}

Best regards,
{candidate_name}"""

    logger.info(f"Generated template email for {company}")
    return subject, body
