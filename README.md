# CareerFlow

CareerFlow is a comprehensive web application designed to streamline the job search process. It automatically scrapes job listings, tailors your resume for shortlisted jobs, and assists with automated, personalized cold email outreach to hiring managers.

## 🌟 Features

- **Multi-Platform Job Scraping**: Concurrently fetch job listings from multiple platforms including Naukri, RemoteOK, and Wellfound.
- **AI-Powered Resume Tailoring**: Automatically generate tailored resumes optimized for the specific job description and perform gap analysis with ATS scoring.
- **Automated Cold Email Outreach**: Generate personalized cold emails using AI and dispatch them directly via SMTP or save them as drafts via IMAP.
- **Candidate Profile Management**: Manage user profiles, base resumes, and configure email client settings securely.

## 🏗️ Architecture

CareerFlow is built as a monorepo using **Turborepo** with the following stack:

- **Frontend (`apps/web`)**: 
  - Next.js (React 19)
  - Tailwind CSS
  - Puppeteer & pdf-parse
  - Groq SDK

- **Backend (`apps/server`)**: 
  - Python FastAPI
  - SQLModel (SQLite database)
  - Concurrent background task execution for scraping

- **Shared Packages**:
  - `packages/scrapers`: Specialized scraping modules for different platforms.
  - `packages/outreach`: AI email generation and SMTP/IMAP dispatching modules.

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+)
- Python (3.9+)
- npm or another package manager

### Installation

1. **Install Node dependencies:**
   From the root directory, run:
   ```bash
   npm install
   ```

2. **Setup the Python Backend:**
   Navigate to the server directory and install Python dependencies:
   ```bash
   cd apps/server
   pip install -r requirements.txt
   ```
   *(We recommend using a virtual environment like `venv` or `conda`)*

3. **Environment Variables:**
   - Copy the `.env.example` file to `.env` in the root directory.
   - Configure your environment variables, including `ENCRYPTION_SECRET` (for secure credential storage) and any required API keys (e.g., Groq API key).

### Running the Application

You can start the entire project in development mode using Turborepo from the root directory:

```bash
npm run dev
```

This will run both the Next.js frontend and the FastAPI backend simultaneously.

Alternatively, you can run them separately:
- **Frontend**: `cd apps/web && npm run dev`
- **Backend**: `cd apps/server && uvicorn main:app --reload --port 8000`

## 🛠️ Tech Stack Highlights
- **Turborepo** for fast, incremental builds.
- **FastAPI** for high-performance Python API endpoints.
- **Next.js App Router** for the React frontend.
- **SQLModel** bridging Pydantic and SQLAlchemy for the database layer.
- **Groq SDK** for ultra-fast AI inference.

## 📝 License
This project is open-source and available under the MIT License.
