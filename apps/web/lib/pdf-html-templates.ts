import { TailoringRun } from './types';

/**
 * Generates styled HTML for a side-by-side landscape comparison proof.
 * This HTML is designed to be printed to PDF via the browser's native print dialog.
 */
export function generateSideBySideHTML(runData: TailoringRun): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Resume Shapeshifter - Comparison Proof</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { 
            size: A4 landscape; 
            margin: 0; 
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { 
            font-family: 'Inter', system-ui, -apple-system, sans-serif; 
            color: #334155; 
            line-height: 1.5; 
            font-size: 10px; 
            margin: 0; 
            padding: 15mm;
            background: #ffffff; 
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            border-bottom: 2px solid #f1f5f9; 
            padding-bottom: 10px; 
            margin-bottom: 15px; 
          }
          .title { 
            font-size: 18px; 
            font-weight: 800; 
            color: #0f172a; 
            letter-spacing: -0.5px; 
          }
          .subtitle {
            margin-top: 4px; 
            font-weight: 500; 
            color: #64748b;
            font-size: 11px;
          }
          .scores-container {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .score-badge { 
            font-weight: 700; 
            padding: 4px 8px; 
            border-radius: 6px; 
            background: #f8fafc; 
            border: 1px solid #e2e8f0; 
            font-size: 10px;
          }
          .score-badge-tailored {
            background: #ecfdf5; 
            color: #065f46; 
            border-color: #a7f3d0;
          }
          .grid { 
            display: flex; 
            gap: 15px; 
          }
          .pane { 
            flex: 1; 
            border: 1px solid #e2e8f0; 
            border-radius: 10px; 
            padding: 12px; 
            background: #f8fafc; 
          }
          .pane-tailored { 
            background: #ffffff; 
            border-color: #d1fae5; 
          }
          .pane-title {
            margin-top: 0; 
            margin-bottom: 10px;
            color: #475569; 
            font-size: 12px; 
            border-bottom: 1px solid #cbd5e1; 
            padding-bottom: 4px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .pane-title-tailored {
            color: #059669; 
            border-bottom-color: #a7f3d0;
          }
          .job-block { 
            margin-bottom: 12px; 
          }
          .job-block:last-child {
            margin-bottom: 0;
          }
          .job-header {
            font-size: 11px;
            color: #1e293b;
            margin-bottom: 6px;
          }
          .job-company {
            color: #64748b;
            font-weight: normal;
          }
          .bullet-list {
            margin: 0; 
            padding-left: 12px;
          }
          .bullet-item {
            margin-bottom: 4px; 
            color: #475569;
            font-size: 10px;
          }
          .bullet-block { 
            margin-bottom: 8px; 
            border-bottom: 1px dashed #e2e8f0; 
            padding-bottom: 6px; 
          }
          .bullet-block:last-child { 
            border: none; 
            padding-bottom: 0;
            margin-bottom: 0;
          }
          .deleted { 
            text-decoration: line-through; 
            color: #94a3b8; 
            display: block; 
            margin-bottom: 2px; 
            font-size: 9.5px;
          }
          .added { 
            font-weight: 500; 
            color: #065f46; 
            background: #ecfdf5; 
            padding: 2px 5px; 
            border-radius: 4px; 
            display: block; 
            font-size: 10px;
          }
          .disclaimer { 
            font-size: 8px; 
            color: #ef4444; 
            border-top: 1px solid #fee2e2; 
            margin-top: 15px; 
            padding-top: 6px; 
            text-align: center; 
            font-weight: 500; 
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">Resume Shapeshifter: Comparison Proof</div>
            <div class="subtitle">Job Title: ${escapeHtml(runData.targetJobDescription.jobTitle)} at ${escapeHtml(runData.targetJobDescription.company || 'Not Specified')}</div>
          </div>
          <div class="scores-container">
            <span class="score-badge">Original Score: ${runData.originalScore.overallScore}/100</span>
            <span style="font-weight:bold; color:#64748b;">→</span>
            <span class="score-badge score-badge-tailored">Tailored Score: ${runData.tailoredScore.overallScore}/100</span>
          </div>
        </div>
        
        <div class="grid">
          <div class="pane">
            <h3 class="pane-title">Original Experience</h3>
            ${runData.originalResume.experience.map(job => `
              <div class="job-block">
                <div class="job-header">
                  <strong>${escapeHtml(job.title)}</strong> <span class="job-company">at ${escapeHtml(job.company)}</span>
                </div>
                <ul class="bullet-list">
                  ${job.bullets.map(b => `<li class="bullet-item">${escapeHtml(b)}</li>`).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
          
          <div class="pane pane-tailored">
            <h3 class="pane-title pane-title-tailored">Tailored Experience</h3>
            ${runData.tailoredResume.tailoredExperience.map(job => `
              <div class="job-block">
                <div class="job-header">
                  <strong>${escapeHtml(job.title)}</strong> <span class="job-company" style="color:#059669;">at ${escapeHtml(job.company)}</span>
                </div>
                <div style="margin-top: 4px;">
                  ${job.bullets.map(b => `
                    <div class="bullet-block">
                      <span class="deleted">${escapeHtml(b.original)}</span>
                      <span class="added">${escapeHtml(b.tailored)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="disclaimer">
          TRUTHFULNESS COMPLIANCE STATEMENT: This tailored profile aligns phrasing to job context using existing resume evidence.
          Experience details, credentials, and achievements must be manually verified by the candidate before submission.
        </div>
      </body>
    </html>
  `;
}

/**
 * Generates styled HTML for a clean, ATS-optimized, recruiter-ready Portrait A4 resume.
 * Hides all tracking scores, strike-throughs, and rationale.
 */
export function generateCleanResumeHTML(runData: TailoringRun): string {
  const contact = runData.originalResume.contact;
  const skills = runData.tailoredResume.tailoredSkills || runData.originalResume.skills || [];
  const experiences = runData.tailoredResume.tailoredExperience || [];
  const projects = runData.originalResume.projects || [];
  const education = runData.originalResume.education || [];
  const certifications = runData.originalResume.certifications || [];
  const summary = runData.tailoredResume.tailoredSummary || runData.originalResume.summary || "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(contact.fullName)} - Tailored Resume</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { 
            size: A4 portrait; 
            margin: 0; 
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { 
            font-family: 'Inter', system-ui, -apple-system, sans-serif; 
            color: #1e293b; 
            line-height: 1.4; 
            font-size: 10px; 
            margin: 0; 
            padding: 20mm;
            background: #ffffff; 
          }
          .header {
            text-align: center;
            margin-bottom: 15px;
          }
          .name {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 5px 0;
            letter-spacing: -0.5px;
            text-transform: uppercase;
          }
          .contact-info {
            font-size: 9px;
            color: #475569;
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 8px;
            margin: 0;
            padding: 0;
            list-style: none;
          }
          .contact-item:not(:last-child)::after {
            content: "•";
            margin-left: 8px;
            color: #94a3b8;
          }
          .section {
            margin-bottom: 15px;
          }
          .section-title {
            font-size: 11px;
            font-weight: 700;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 3px;
            margin: 0 0 8px 0;
          }
          .summary-text {
            color: #334155;
            text-align: justify;
            margin: 0;
          }
          .skills-list {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin: 0;
            padding: 0;
            list-style: none;
          }
          .skill-item {
            background: #f1f5f9;
            color: #334155;
            padding: 3px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 500;
          }
          .job-block {
            margin-bottom: 12px;
          }
          .job-block:last-child {
            margin-bottom: 0;
          }
          .job-header {
            display: flex;
            justify-content: space-between;
            font-weight: 700;
            color: #0f172a;
            font-size: 10px;
            margin-bottom: 3px;
          }
          .job-meta {
            display: flex;
            justify-content: space-between;
            color: #475569;
            font-size: 9px;
            font-weight: 500;
            margin-bottom: 4px;
          }
          .bullet-list {
            margin: 0;
            padding-left: 15px;
            list-style-type: disc;
          }
          .bullet-item {
            margin-bottom: 3px;
            color: #334155;
            text-align: justify;
          }
          .bullet-item:last-child {
            margin-bottom: 0;
          }
          .edu-block {
            margin-bottom: 8px;
          }
          .edu-block:last-child {
            margin-bottom: 0;
          }
          .certs-list {
            margin: 0;
            padding-left: 15px;
          }
          .cert-item {
            margin-bottom: 3px;
            color: #334155;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="name">${escapeHtml(contact.fullName)}</h1>
          <ul class="contact-info">
            ${contact.email ? `<li class="contact-item">${escapeHtml(contact.email)}</li>` : ''}
            ${contact.phone ? `<li class="contact-item">${escapeHtml(contact.phone)}</li>` : ''}
            ${contact.location ? `<li class="contact-item">${escapeHtml(contact.location)}</li>` : ''}
            ${contact.websiteUrls && contact.websiteUrls.length > 0 
              ? contact.websiteUrls.map(url => `<li class="contact-item">${escapeHtml(url)}</li>`).join('') 
              : ''}
          </ul>
        </div>

        ${summary ? `
          <div class="section">
            <h2 class="section-title">Professional Summary</h2>
            <p class="summary-text">${escapeHtml(summary)}</p>
          </div>
        ` : ''}

        ${skills.length > 0 ? `
          <div class="section">
            <h2 class="section-title">Technical Skills</h2>
            <ul class="skills-list">
              ${skills.map(s => `<li class="skill-item">${escapeHtml(s)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${experiences.length > 0 ? `
          <div class="section">
            <h2 class="section-title">Professional Experience</h2>
            ${experiences.map((job, idx) => {
              const origJob = runData.originalResume.experience[idx] || {} as Record<string, unknown>;
              return `
                <div class="job-block">
                  <div class="job-header">
                    <span>${escapeHtml(job.title)}</span>
                    <span>${escapeHtml(job.company)}</span>
                  </div>
                  <div class="job-meta">
                    <span>${escapeHtml((origJob as any).location || 'Not Specified')}</span>
                    <span>${escapeHtml((origJob as any).startDate || '')} – ${escapeHtml((origJob as any).endDate || 'Present')}</span>
                  </div>
                  <ul class="bullet-list">
                    ${job.bullets.map(b => `<li class="bullet-item">${escapeHtml(b.tailored)}</li>`).join('')}
                  </ul>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        ${projects.length > 0 ? `
          <div class="section">
            <h2 class="section-title">Projects</h2>
            ${projects.map(p => `
              <div class="job-block">
                <div class="job-header">
                  <span>${escapeHtml(p.name)}</span>
                  ${p.technologiesUsed && p.technologiesUsed.length > 0 
                    ? `<span style="font-weight: 500; font-size: 8.5px; color: #475569;">[${p.technologiesUsed.map(t => escapeHtml(t)).join(', ')}]</span>` 
                    : ''}
                </div>
                ${p.description ? `<p class="summary-text" style="font-size: 9px; margin-bottom: 4px; color: #475569;">${escapeHtml(p.description)}</p>` : ''}
                ${p.bullets && p.bullets.length > 0 ? `
                  <ul class="bullet-list">
                    ${p.bullets.map(b => `<li class="bullet-item">${escapeHtml(b)}</li>`).join('')}
                  </ul>
                ` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${education.length > 0 ? `
          <div class="section">
            <h2 class="section-title">Education</h2>
            ${education.map(e => `
              <div class="edu-block">
                <div class="job-header">
                  <span>${escapeHtml(e.degree)} ${e.fieldOfStudy ? `in ${escapeHtml(e.fieldOfStudy)}` : ''}</span>
                  <span>${escapeHtml(e.institution)}</span>
                </div>
                <div class="job-meta">
                  <span></span>
                  <span>Graduated: ${escapeHtml(e.graduationDate)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${certifications.length > 0 ? `
          <div class="section">
            <h2 class="section-title">Certifications</h2>
            <ul class="certs-list">
              ${certifications.map(c => `<li class="cert-item">${escapeHtml(c)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </body>
    </html>
  `;
}

/** Escape HTML special characters to prevent XSS in template strings */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
