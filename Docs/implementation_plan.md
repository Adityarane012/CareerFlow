# 📋 Project Implementation Plan: CareerFlow Platform

This document outlines the step-by-step engineering plan to build the **CareerFlow Platform** by integrating **Job Agent** (scraping), **Resume Shapeshifter** (tailoring), and **The Closer** (outreach) into a single monorepo.

---

## Phase 1: Bootstrap & Monorepo Setup

### 1.1. Goal
Initialize the repository as a monorepo workspace, configure the relational database schema, and set up AES-GCM-256 credential encryption.

### 1.2. Tasks & Action Items
* [x] **Monorepo Structure Setup**:
  * Run `npm init` at the workspace root and define workspaces: `"apps/*"` and `"packages/*"`.
  * Set up `turbo.json` for task caching and execution orchestration.
  * Initialize `apps/web` (Next.js 16 structure using typescript).
  * Initialize `apps/server` (FastAPI sidecar structure with poetry/requirements).
* [x] **Database Initialization**:
  * Configure PostgreSQL connection drivers and SQLite local configs via SQLAlchemy/SQLModel.
  * Write the database models (matching schemas in `Docs/Architecture.md` for `users`, `job_listings`, `applications`, and `outreach_logs`).
  * Run initial migrations using Alembic.
* [x] **Security Utilities**:
  * Implement encryption modules in Python using `cryptography` (AES-GCM-256) for secure storage of SMTP/IMAP passwords.
  * Provide credential check endpoints verifying keys before encryption.

### 1.3. Proposed Changes

#### [NEW] [package.json](../package.json)
Workspace configuration definitions.

#### [NEW] [turbo.json](../turbo.json)
Turborepo configuration.

#### [NEW] [apps/server/main.py](../apps/server/main.py)
Backend FastAPI server entry point.

#### [NEW] [apps/server/src/models.py](../apps/server/src/models.py)
Relational models and schemas.

#### [NEW] [apps/server/src/security.py](../apps/server/src/security.py)
AES-GCM-256 encryption utils.

### 1.4. Verification Plan
* **Automated Tests**:
  * Run unit tests on encryption utilities: `pytest apps/server/tests/test_security.py`
  * Verify database tables creation: `pytest apps/server/tests/test_models.py`
* **Manual Verification**:
  * Launch FastAPI server (`uvicorn main:app --reload`) and hit `/docs` interface to verify endpoint definitions.
* **Edge Case Verification**:
  * Compulsorily check and log the edge cases defined in [edge-case.md](../Docs/edge-case.md#phase-1-bootstrap--monorepo-setup) (e.g. missing credentials behavior, upsert registration limits).

---

## Phase 2: Discovery Engine Integration

### 2.1. Goal
Integrate and modernize the multi-threaded scrapers from the **Job Agent** project to run as asynchronous database ingestion pipelines.

### 2.2. Tasks & Action Items
* [x] **Worker Queue Porting**:
  * Copy scraper files (`naukri.py`, `remote_ok.py`, `wellfound.py`) into the `packages/scrapers/` folder.
  * Adapt scrapers to return structured list objects instead of CLI outputs.
  * Implement background scraping using FastAPI's `BackgroundTasks`.
* [x] **Data Sanitization**:
  * Port `text_cleaner.py` and incorporate its CP1252 mojibake decoder and HTML tag stripper into the database write pipeline.
  * Enforce unique key constraints: `(title, company, platform, location)` during ingestion to drop duplicate listings.
* [x] **Discovery UI**:
  * Build a Next.js search dashboard featuring search input, platform selectors, and scrape progress statuses.
  * Render scraped listings in a high-density tabular grid with sorting and a "Shortlist" action.

### 2.3. Proposed Changes

#### [NEW] [packages/scrapers/src/cleaner.py](../packages/scrapers/src/cleaner.py)
Extracted cleaning algorithms.

#### [NEW] [packages/scrapers/src/engine.py](../packages/scrapers/src/engine.py)
Multi-threaded scraper runner.

#### [MODIFY] [apps/server/main.py](../apps/server/main.py)
Add scraper and trigger routes.

#### [NEW] [apps/web/app/jobs/page.tsx](../apps/web/app/jobs/page.tsx)
Next.js Discovery UI panel.

### 2.4. Verification Plan
* **Automated Tests**:
  * Run cleanup checks: `pytest packages/scrapers/tests/test_cleaner.py`
  * Test concurrent scraping mock runs: `pytest packages/scrapers/tests/test_engine.py`
* **Manual Verification**:
  * Trigger search query from Next.js dashboard, verify database population, and check console log streams.
* **Edge Case Verification**:
  * Verify raw Unicode mojibake recovery and incomplete trailing HTML tag stripping using test items in [edge-case.md](../Docs/edge-case.md#phase-2-discovery-engine-integration).

---

## Phase 3: Resume Tailoring Workspace

### 3.1. Goal
Integrate **Resume Shapeshifter**'s optimization models to analyze JD gaps, perform surgical bullet point adjustments, and render A4 PDFs.

### 3.2. Tasks & Action Items
* [x] **Document Parsing Integration**:
  * Connect `pdf-parse` and `mammoth` inside Next.js node environments or backend sidecar.
  * Set up resume ingestion workspace with file drop boxes.
* [x] **Groq ATS Scoring Engine**:
  * Construct prompt pipelines matching resumes with job details.
  * Build the JSON gap matrix validator enforcing strict structural formats.
  * Implement the double-fail-safe merge routine to prevent resume content loss.
* [x] **Headless Chromium rendering**:
  * Configure the dynamic Puppeteer loader importing `@sparticuz/chromium` in Vercel production and standard `puppeteer` locally.
  * Build the A4 template compiler and link the output paths back to the application database tables.
* [x] **Surgical Bullet UI Workspace**:
  * Implement a split-screen panel showing JD on the left and bullet diffs on the right.
  * Build interactive selectors (checkboxes) to accept/reject LLM modifications.

### 3.3. Proposed Changes

#### [NEW] [apps/web/app/api/tailor/route.ts](../apps/web/app/api/tailor/route.ts)
Tailor middleware handler.

#### [NEW] [apps/web/lib/pdf/compiler.ts](../apps/web/lib/pdf/compiler.ts)
Chromium browser loading and rendering logic.

#### [NEW] [apps/web/app/tailor/[appId]/page.tsx](../apps/web/app/tailor/[appId]/page.tsx)
Dual-pane split dashboard panel.

### 3.4. Verification Plan
* **Automated Tests**:
  * Test parsing inputs on sample PDFs/DOCX: `npm run test:parse`
  * Test dynamic puppeteer browser launching: `npm run test:puppeteer`
* **Manual Verification**:
  * Upload a PDF resume, select a job, run optimization, select diffs, and download compiled print-ready A4 PDF.
* **Edge Case Verification**:
  * Test ingestion parser tolerance to corrupted/empty files and LLM safety checks for experience fabrication flags detailed in [edge-case.md](../Docs/edge-case.md#phase-3-resume-tailoring-workspace).

---

## Phase 4: Outreach Console

### 4.1. Goal
Integrate **The Closer**'s email engines to construct personalized outreach messages, auto-map contacts, and execute secure IMAP/SMTP dispatches.

### 4.2. Tasks & Action Items
* [x] **Context-Aware Email Generator**:
  * Construct outreach prompt templates parsing original resumes, tailored bullets, target roles, and personalized hooks.
  * Route requests to Llama 3.3, parsing JSON email subject and body configurations.
* [x] **Outreach Dispatch Services**:
  * Link SMTP STARTTLS (port 587) logic and write dispatch handlers.
  * Setup IMAP Draft Writer (port 993) including search fallboxes: `[Gmail]/Drafts`, `Drafts`, `Draft`, `INBOX.Drafts`.
* [x] **Automated Contact Mapping**:
  * Write mapper queries linking `JobListing` recruiter details and `User` background profiles automatically, removing manual JSON loads.
* [x] **Email Composer UI**:
  * Create email editor views with `To`, `Subject`, `Body` editors, and connection logs console panels.

### 4.3. Proposed Changes

#### [NEW] [packages/outreach/src/generator.py](../packages/outreach/src/generator.py)
Groq outreach composition engine.

#### [NEW] [packages/outreach/src/sender.py](../packages/outreach/src/sender.py)
SMTP and IMAP drivers.

#### [NEW] [apps/web/app/outreach/[appId]/page.tsx](../apps/web/app/outreach/[appId]/page.tsx)
Interactive email composer panel.

### 4.4. Verification Plan
* **Automated Tests**:
  * Verify SMTP and IMAP connection dry runs: `pytest packages/outreach/tests/test_sender.py`
  * Run outreach generation logic tests: `pytest packages/outreach/tests/test_generator.py`
* **Manual Verification**:
  * Setup local credentials, write a mock draft, verify it populates your Gmail draft folder correctly, and confirm the log update in `outreach_logs`.
* **Edge Case Verification**:
  * Validate that SMTP connection authentication failures trigger redirection to IMAP Drafts fallback and check folder fallback list defined in [edge-case.md](../Docs/edge-case.md#phase-4-outreach-console).

---

## Phase 5: Unified Status Dashboard

### 5.1. Goal
Consolidate the application states and launch the interactive Kanban Tracking Dashboard.

### 5.2. Tasks & Action Items
* [x] **State Machine & Pipeline**:
  * Define state transitions matching: `DISCOVERED ➔ SHORTLISTED ➔ RESUME_TAILORED ➔ EMAIL_GENERATED ➔ DRAFTED_IMAP ➔ SENT_SMTP`.
  * Ensure trigger dispatches update states automatically in the background.
* [x] **Kanban Board UI Layout**:
  * Build the Kanban board panel using drag-and-drop or status grid selectors.
  * Set up dashboard details: filters by platform, searches, and activity lists.
* [x] **SaaS Visual Refinements**:
  * Refine the Vanilla CSS style definitions to lock down the "non-AI" aesthetic.

### 5.3. Proposed Changes

#### [NEW] [apps/web/app/dashboard/page.tsx](../apps/web/app/dashboard/page.tsx)
Core application Kanban Tracker workspace.

#### [MODIFY] [apps/web/app/globals.css](../apps/web/app/globals.css)
Lock in slate, cool-gray, border grids, and typography guidelines.

### 5.4. Verification Plan
* **Automated Tests**:
  * Validate UI routes and rendering components: `npm run test:e2e`
* **Manual Verification**:
  * Move cards through statuses, click cards to jump into split-pane tailoring or email composer, and verify all transitions update database rows instantly.
* **Edge Case Verification**:
  * Verify database schema state updates and credential deletion behaviors under [edge-case.md](../Docs/edge-case.md#phase-5-unified-status-dashboard).
