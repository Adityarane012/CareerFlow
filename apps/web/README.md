# 🌀 Resume Shapeshifter

Resume Shapeshifter is a state-of-the-art, ATS-optimized resumé tailoring platform built with **Next.js 16**, **Groq SDK (Llama 3.3 70B)**, and **Puppeteer / Headless Chromium**. It ingests raw or binary resumes (PDF/DOCX/TXT), matches them against a target job description, performs surgical bullet rephrasing with strict truthfulness guardrails, runs ATS-scoring/gap analysis, and generates print-ready recruiter PDFs.

---

## 🌟 Key Features

* **🧠 Smart ATS Scoring & Gap Matrix:** Analyzes technical skills, keyword densities, responsibility alignment, and seniority fits, outputting a highly detailed comparative compatibility score.
* **🔬 Resilient Multi-Format Ingestion:** Standardized Zod preprocessors dynamically sanitize messy inputs (empty fields, placeholder emails, dirty formatting) to ensure file parsing never crashes.
* **✂️ Surgical Bullet surgery:** Adapts job bullets to JD keywords without fabricating achievements, Escalating responsibilities, or escalating metrics.
* **🔄 Persistent JD Navigation ("Compare Another JD"):** Shuts back to inputs while retaining all resume details, letting you compare the same resume across many JDs.
* **📃 Recruiter Portrait A4 PDF Exports:** Instantly compiles a standard, print-ready portrait PDF of your tailored resume, hiding scores/diff markers, and showing only clean, application-ready content.
* **🤝 Double-Fail-Safe Merging:** Implements automatic merging fallbacks that guarantee no job experiences, bullet points, or skills are ever lost or truncated by the LLM.
* **⚡ Serverless-Ready Puppeteer Engine:** Dynamic launcher automatically loads `@sparticuz/chromium` on serverless production builds (Vercel) and standard `puppeteer` locally.

---

## 🛠️ Technology Stack

* **Frontend & Backend Logic:** Next.js 16.2 (App Router & TS)
* **LLM Ingest & Orchestration:** Groq SDK (Model: `llama-3.3-70b-versatile`)
* **Styling & Visual Design:** Vanilla CSS with custom Harmonies, HSL Tailored Gradients, and animations
* **Binary File Extraction:** `pdf-parse` (PDF) & `mammoth` (Word / .docx)
* **Layout Compilation Engine:** Puppeteer & headless Chromium

---

## ⚙️ Quick Start (Local Setup)

### 1. Prerequisites
- Node.js v18 or later
- Groq Cloud API Key (Get a free key at **[Groq Console](https://console.groq.com/keys)**)

### 2. Installation
Clone the repository and install all node packages:
```bash
npm install
```

### 3. Environment Secrets Setup
Create a `.env.local` file at the root of the project:
```env
# Groq LLM Key & Model
GROQ_API_KEY=gsk_your_real_key_here
LLM_MODEL=llama-3.3-70b-versatile

# Production URL reference
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Boot Dev Server
Start Next.js under the dev server:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## 🚀 GitHub & Vercel Deployment Guide

This project is pre-configured and hardened for **Vercel Serverless Functions**.

### Vercel Deployment Checklist:

1. **Create Project:** Link your GitHub repo to your Vercel Dashboard.
2. **Configure Environment Variables:** Add these three critical variables in Vercel's Console settings before deploying:

   | Key | Value | Purpose |
   | :--- | :--- | :--- |
   | `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | `true` | **Crucial:** Prevents Vercel from downloading the 150MB Chromium package at build-time, staying under Serverless size limits. |
   | `GROQ_API_KEY` | `gsk_your_api_key` | Your active Groq SDK credentials. |
   | `LLM_MODEL` | `llama-3.3-70b-versatile` | Production LLM target model. |

3. **External Bundling Externals:**
   The compiler has been set up using `serverExternalPackages: ['pdf-parse', 'puppeteer-core', '@sparticuz/chromium']` inside `next.config.ts` to ensure that chromium binaries are loaded dynamically from `node_modules` at runtime, completely avoiding webpack chunk corruption.

*For alternative PaaS deployments (Render / Railway / Nixpacks), review our detailed **[Production Deployment Manual](../../apps/web/careerflow-web/docs/deployment.md)**.*

---

## 🛡️ Truthfulness Guardrails & Compliance

Resume Shapeshifter enforces strict compliance bounds:
1. **No Experience Fabrication:** Under no circumstances will the tailoring engine invent credentials, certifications, or past employers.
2. **Context Retention:** Maintains precise numeric bounds (budget metrics, team sizes) without inflating scale.
3. **Candidate Verification:** Displays warning flags (`⚠ Risk Flag`) on rephrasings that hold high contextual modifications so the user can verify them manually before exporting.
