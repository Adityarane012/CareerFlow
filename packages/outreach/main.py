import os
import sys
import json
import logging
from dotenv import load_dotenv

# Configure basic logging level for internal operations
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("app.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
# Lower the log level for stream handler to avoid cluttering CLI unless requested
for handler in logging.getLogger().handlers:
    if isinstance(handler, logging.StreamHandler):
        handler.setLevel(logging.WARNING)

# Ensure local imports work fine
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from email_generator import generate_email
from email_sender import send_email_smtp, save_draft_imap
from logger import log_outreach

# CLI styling tokens
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

# Enable Windows virtual terminal codes for premium CLI experience
if sys.platform == "win32":
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        # ENABLE_PROCESSED_OUTPUT = 1, ENABLE_WRAP_AT_EOL_OUTPUT = 2, ENABLE_VIRTUAL_TERMINAL_PROCESSING = 4
        # Combine: 1 | 2 | 4 = 7
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        # Fallback: disable formatting tags if terminal configuration fails
        class Colors:
            HEADER = ''
            BLUE = ''
            CYAN = ''
            GREEN = ''
            YELLOW = ''
            RED = ''
            END = ''
            BOLD = ''
            UNDERLINE = ''

def load_contacts(filepath="contacts.json"):
    """Loads target contact records from the JSON database."""
    if not os.path.exists(filepath):
        print(f"{Colors.RED}[Error] Contacts database file '{filepath}' not found.{Colors.END}")
        sys.exit(1)
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"{Colors.RED}[Error] Malformed JSON in '{filepath}': {e}{Colors.END}")
        sys.exit(1)

def print_banner(dry_run):
    """Displays application banner in the terminal."""
    mode_text = f"{Colors.YELLOW}DRY RUN MODE ACTIVE (Simulated, safe to test){Colors.END}" if dry_run else f"{Colors.RED}LIVE MODE ACTIVE (Warning: emails will be sent/drafted!){Colors.END}"
    
    print("=" * 60)
    print(f"        {Colors.HEADER}{Colors.BOLD}THE CLOSER — Cold Email Writer & Send Bot{Colors.END}")
    print(f"                       Status: {mode_text}")
    print("=" * 60)

def main():
    # Load env file configurations
    load_dotenv()
    
    dry_run = os.getenv("DRY_RUN", "true").lower() == "true"
    sender_name = os.getenv("SENDER_NAME", "Job Seeker")
    smtp_user = os.getenv("SMTP_USER", "")
    
    print_banner(dry_run)
    
    # Validation warning
    if not dry_run and not smtp_user:
        print(f"{Colors.RED}[Error] SMTP_USER is not configured in .env. Exiting.{Colors.END}")
        sys.exit(1)
        
    contacts = load_contacts()
    total = len(contacts)

    if total == 0:
        print(f"{Colors.YELLOW}[Notice] 0 targets loaded from contacts.json. Nothing to do. Exiting.{Colors.END}")
        sys.exit(0)

    print(f"Successfully loaded {Colors.GREEN}{total}{Colors.END} outreach targets from contacts.json.\n")
    
    for i, target in enumerate(contacts, 1):
        company = target.get("company", "Unknown Company")
        role = target.get("role", "Unknown Role")
        recipient_name = target.get("recipient_name", "Hiring Contact")
        recipient_email = target.get("recipient_email", "")
        
        print("-" * 60)
        print(f"{Colors.BOLD}Outreach Target {i} of {total}:{Colors.END} {Colors.CYAN}{company} — {role}{Colors.END}")
        print(f"Contact Person : {recipient_name} ({recipient_email})")
        print("-" * 60)
        
        # Generation step
        print("Generating personalized email content...")
        subject, body = generate_email(target)
        
        # Preview formatting
        print(f"\n{Colors.BOLD}{Colors.UNDERLINE}EMAIL PREVIEW:{Colors.END}")
        print(f"{Colors.BLUE}{Colors.BOLD}Subject:{Colors.END} {subject}")
        print(f"{Colors.BLUE}{Colors.BOLD}Body:{Colors.END}")
        print(f"{Colors.GREEN}{body}{Colors.END}")
        print("-" * 60)
        
        # Prompt interaction
        while True:
            prompt_str = f"Choose Action for {company}: [{Colors.GREEN}s{Colors.END}]end | [{Colors.GREEN}d{Colors.END}]raft | [{Colors.YELLOW}k{Colors.END}]ip | [{Colors.RED}q{Colors.END}]uit? "
            choice = input(prompt_str).strip().lower()
            
            if choice == 's':
                print("Processing SMTP Send...")
                status, err = send_email_smtp(recipient_email, subject, body, sender_name)
                
                if status == "sent":
                    print(f"{Colors.GREEN}[Success] Email sent to {recipient_email}!{Colors.END}")
                elif status == "dry_run":
                    print(f"{Colors.YELLOW}[Simulated] Sent email draft to {recipient_email} (Dry-Run).{Colors.END}")
                else:
                    print(f"{Colors.RED}[Error] SMTP Send failed: {err}{Colors.END}")
                    
                log_outreach(recipient_email, company, role, subject, status, err)
                break
                
            elif choice == 'd':
                print("Processing IMAP Draft creation...")
                status, err = save_draft_imap(recipient_email, subject, body, sender_name)
                
                if status == "drafted":
                    print(f"{Colors.GREEN}[Success] Draft successfully created in your Gmail/IMAP folder!{Colors.END}")
                elif status == "dry_run":
                    print(f"{Colors.YELLOW}[Simulated] Created draft in your IMAP folder (Dry-Run).{Colors.END}")
                else:
                    print(f"{Colors.RED}[Error] IMAP Draft creation failed: {err}{Colors.END}")
                    
                log_outreach(recipient_email, company, role, subject, status, err)
                break
                
            elif choice == 'k':
                print(f"{Colors.YELLOW}Skipped contact for {company}.{Colors.END}")
                log_outreach(recipient_email, company, role, subject, "skipped")
                break
                
            elif choice == 'q':
                print(f"\n{Colors.BOLD}Outreach run aborted by user. Exiting.{Colors.END}")
                sys.exit(0)
                
            else:
                print(f"{Colors.RED}Invalid input. Please choose 's', 'd', 'k', or 'q'.{Colors.END}")
        print() # empty spacer line
        
    print("=" * 60)
    print(f"     {Colors.GREEN}{Colors.BOLD}Process complete. All outreach log records saved.{Colors.END}")
    print(f"     Review: {Colors.CYAN}outreach_log.csv{Colors.END}")
    print("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.RED}Process interrupted by user. Exiting.{Colors.END}")
        sys.exit(0)
