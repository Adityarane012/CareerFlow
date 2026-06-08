'use client';

import React, { useState, useEffect, use } from 'react';
import { 
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Terminal,
  Save,
  FileText,
  ExternalLink
} from 'lucide-react';
import { SideBySideDiff } from '../../../components/SideBySideDiff';
import { ScoreCard } from '../../../components/ScoreCard';
import { GapAnalysis } from '../../../components/GapAnalysis';
import { generateCleanResumeHTML } from '../../../lib/pdf-html-templates';
import { ResumeProfile, TailoredResume, MatchScore, ResumeGap, TailoringRun, JobDescriptionProfile } from '../../../lib/types';

interface PageProps {
  params: Promise<{ appId: string }>;
}

export default function AppTailorWorkspace({ params }: PageProps) {
  const { appId } = use(params);

  // Core Application Data
  const [appDetails, setAppDetails] = useState<any>(null);
  const [isLoadingApp, setIsLoadingApp] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);

  // Input states (initialized from app details)
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  // Analysis status and results
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [originalResume, setOriginalResume] = useState<ResumeProfile | null>(null);
  const [targetJobDescription, setTargetJobDescription] = useState<JobDescriptionProfile | null>(null);
  const [originalScore, setOriginalScore] = useState<MatchScore | null>(null);
  const [tailoredScore, setTailoredScore] = useState<MatchScore | null>(null);
  const [tailoredResume, setTailoredResume] = useState<TailoredResume | null>(null);
  const [identifiedGaps, setIdentifiedGaps] = useState<ResumeGap[]>([]);
  const [runData, setRunData] = useState<TailoringRun | null>(null);

  // Checkbox state map: "jobIdx-bulletIdx" -> boolean
  const [acceptedBullets, setAcceptedBullets] = useState<Record<string, boolean>>({});

  // Compilation and save status
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Console log stream for Stripe/GitHub SaaS aesthetic
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // 1. Fetch application details from backend on mount
  useEffect(() => {
    async function loadApplication() {
      setIsLoadingApp(true);
      setAppError(null);
      addLog(`Connecting to FastAPI gateway for application: ${appId}...`);

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        const res = await fetch(`${backendUrl}/api/v1/applications/${appId}`);
        
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(`Application ${appId} not found in database.`);
          }
          throw new Error(`Failed to load application context. Server returned code ${res.status}`);
        }

        const data = await res.json();
        setAppDetails(data);
        setResumeText(data.base_resume_text || '');
        setJobDescription(data.scraped_description || '');
        addLog(`Loaded application details for ${data.job_title} at ${data.company}.`);
        addLog(`Base resume length: ${data.base_resume_text?.length || 0} characters.`);

        // Automatically trigger optimization if inputs are present
        if (data.base_resume_text && data.scraped_description) {
          triggerOptimization(data.base_resume_text, data.scraped_description);
        } else {
          addLog(`[WARNING] Incomplete application inputs. Base resume or job description text is empty.`);
        }
      } catch (err) {
        console.error(err);
        const errMsg = (err as Error).message || 'Failed to fetch application details.';
        setAppError(errMsg);
        addLog(`[ERROR] Connection failed: ${errMsg}`);
      } finally {
        setIsLoadingApp(false);
      }
    }

    loadApplication();
  }, [appId]);

  // 2. Trigger tailoring optimization via LLM endpoints
  const triggerOptimization = async (resText: string, jdText: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalyzed(false);
    setSaveStatus(null);
    addLog(`Initiating optimization pipeline...`);

    try {
      addLog(`[Step 1/2] Analyzing ATS gaps and parsing resume profile...`);
      const analyzeRes = await fetch('/api/tailor/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: resText, jobDescription: jdText })
      });

      if (!analyzeRes.ok) {
        const errData = await analyzeRes.json();
        throw new Error(errData.error || 'Failed to analyze resume gaps.');
      }
      
      const analyzeData = await analyzeRes.json();
      addLog(`ATS Gap analysis complete. Original score: ${analyzeData.originalScore?.overallScore || 0}/100.`);

      addLog(`[Step 2/2] Running surgical bullet rewriter (Llama 3.3)...`);
      const rewriteRes = await fetch('/api/tailor/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalResume: analyzeData.originalResume,
          targetJobDescription: analyzeData.targetJobDescription,
          originalScore: analyzeData.originalScore,
          identifiedGaps: analyzeData.identifiedGaps
        })
      });

      if (!rewriteRes.ok) {
        const errData = await rewriteRes.json();
        throw new Error(errData.error || 'Failed to rewrite resume experience bullets.');
      }

      const rewriteData = await rewriteRes.json();
      addLog(`Surgical bullet rewriting completed successfully.`);
      addLog(`Optimized tailored score: ${rewriteData.tailoredScore?.overallScore || 0}/100.`);

      // Store results
      setOriginalResume(analyzeData.originalResume);
      setTargetJobDescription(analyzeData.targetJobDescription);
      setOriginalScore(analyzeData.originalScore);
      setIdentifiedGaps(analyzeData.identifiedGaps);
      
      setTailoredResume(rewriteData.tailoredResume);
      setTailoredScore(rewriteData.tailoredScore);
      setRunData(rewriteData);
      setAnalyzed(true);

      // Initialize all bullets to checked (accepted) by default
      const initialChecked: Record<string, boolean> = {};
      rewriteData.tailoredResume.tailoredExperience.forEach((job: any, jobIdx: number) => {
        job.bullets.forEach((_: any, bulletIdx: number) => {
          initialChecked[`${jobIdx}-${bulletIdx}`] = true;
        });
      });
      setAcceptedBullets(initialChecked);
      addLog(`All LLM proposed edits loaded. Checking checkboxes to accept edits selectively.`);

    } catch (err) {
      console.error(err);
      const errMsg = (err as Error).message || 'Failed to complete tailoring process.';
      setAnalysisError(errMsg);
      addLog(`[ERROR] Optimization pipeline crashed: ${errMsg}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleBullet = (jobIdx: number, bulletIdx: number) => {
    const key = `${jobIdx}-${bulletIdx}`;
    setAcceptedBullets(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      addLog(`Bullet edit [${jobIdx}, ${bulletIdx}] set to ${updated[key] ? 'ACCEPTED' : 'REJECTED (Fallback to original)'}`);
      return updated;
    });
  };

  // 3. Compile PDF server-side and save to database
  const handleSaveAndCompile = async () => {
    if (!runData || !originalResume || !tailoredResume) return;

    setIsSaving(true);
    setSaveStatus(null);
    addLog(`Compiling tailored resume using server-side Puppeteer compiler...`);

    try {
      // 1. Build the customized tailoredResume structure depending on bullet checkboxes
      const customizedExperience = tailoredResume.tailoredExperience.map((job: any, jobIdx: number) => {
        return {
          company: job.company,
          title: job.title,
          bullets: job.bullets.map((bullet: any, bulletIdx: number) => {
            const isAccepted = acceptedBullets[`${jobIdx}-${bulletIdx}`] !== false;
            return {
              original: bullet.original,
              // If accepted, use tailored text. If rejected, fallback to original text!
              tailored: isAccepted ? bullet.tailored : bullet.original,
              changeReason: bullet.changeReason,
              keywordsAddressed: bullet.keywordsAddressed,
              confidence: bullet.confidence,
              riskFlag: bullet.riskFlag
            };
          })
        };
      });

      // Assemble customized runData for template compiler
      const customizedRunData: TailoringRun = {
        ...runData,
        tailoredResume: {
          ...tailoredResume,
          tailoredExperience: customizedExperience
        }
      };

      // 2. Generate clean portrait A4 HTML
      addLog(`Generating clean recruiter-ready A4 HTML layout...`);
      const html = generateCleanResumeHTML(customizedRunData);

      // 3. Call server-side Puppeteer compiler route to compile PDF to public/resumes/[appId].pdf
      addLog(`Executing headless Chromium PDF rendering...`);
      const compileRes = await fetch('/api/export/pdf/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, appId })
      });

      if (!compileRes.ok) {
        const errData = await compileRes.json();
        throw new Error(errData.error || 'Puppeteer failed to compile A4 PDF.');
      }

      const { pdfUrl } = await compileRes.json();
      addLog(`PDF compiled successfully and written to assets: ${pdfUrl}`);

      // 4. Sync details back to the FastAPI sidecar database
      addLog(`Persisting optimized resume states inside relational database table...`);
      
      // Calculate final tailored resume flat text for database storage
      const flatResumeText = `
${originalResume.contact.fullName}
${originalResume.contact.email} | ${originalResume.contact.phone} | ${originalResume.contact.location}

TECHNICAL SKILLS:
${(tailoredResume.tailoredSkills || originalResume.skills).join(', ')}

PROFESSIONAL EXPERIENCE:
${customizedExperience.map(job => `
${job.title} at ${job.company}
${job.bullets.map((b: any) => `• ${b.tailored}`).join('\n')}
`).join('\n')}
      `.trim();

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const dbSaveRes = await fetch(`${backendUrl}/api/v1/applications/tailor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: appId,
          tailored_resume_text: flatResumeText,
          tailored_resume_url: `${frontendUrl}${pdfUrl}`, // Absolute URL to static PDF route
          ats_score: Math.round(tailoredScore?.overallScore || 0),
          gap_analysis_json: JSON.stringify(identifiedGaps)
        })
      });

      if (!dbSaveRes.ok) {
        const errData = await dbSaveRes.json();
        const detailMsg = typeof errData.detail === 'object' ? JSON.stringify(errData.detail) : errData.detail;
        throw new Error(detailMsg || 'Failed to write application states to SQLite.');
      }

      const dbData = await dbSaveRes.json();
      addLog(`Database records synchronized. Application status advanced to: RESUME_TAILORED.`);
      setSaveStatus({
        type: 'success',
        message: 'Optimized resume compiled and saved back to database successfully!'
      });

      // Update local appDetails URL
      setAppDetails((prev: any) => ({
        ...prev,
        tailored_resume_url: `${frontendUrl}${pdfUrl}`,
        status: 'RESUME_TAILORED'
      }));

    } catch (err) {
      console.error(err);
      const errMsg = (err as Error).message || 'Failed to save optimization session.';
      setSaveStatus({
        type: 'error',
        message: errMsg
      });
      addLog(`[ERROR] Save failed: ${errMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 1. Header and Navigation */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <a
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-all mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </a>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Resume Tailoring Workspace
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Application ID: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-xs">{appId}</span>
          </p>
        </div>

        {analyzed && (
          <div className="flex items-center gap-3 w-full md:w-auto">
            {appDetails?.tailored_resume_url && (
              <a
                href={appDetails.tailored_resume_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300/80 rounded-lg transition-all"
              >
                <FileText className="h-3.5 w-3.5" />
                View Compiled PDF
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button
              onClick={handleSaveAndCompile}
              disabled={isSaving || isAnalyzing}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all w-full md:w-auto"
            >
              {isSaving ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isSaving ? 'Compiling PDF & Saving...' : 'Save & Compile PDF'}
            </button>
          </div>
        )}
      </div>

      {/* 2. Success/Error Status banners */}
      {saveStatus && (
        <div className={`mb-6 flex items-start gap-3 border rounded-xl p-4 text-sm ${
          saveStatus.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {saveStatus.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <strong className="block font-bold">
              {saveStatus.type === 'success' ? 'Workspace Synchronized' : 'Save Error'}
            </strong>
            <span className="leading-relaxed mt-0.5 block">{saveStatus.message}</span>
          </div>
        </div>
      )}

      {/* 3. Loading Page State */}
      {isLoadingApp ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] border border-slate-200 bg-white rounded-2xl p-8">
          <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mb-4" />
          <h2 className="text-lg font-bold text-slate-800">Loading Application Context</h2>
          <p className="text-xs text-slate-500 mt-1">Retrieving original candidate CV and scraped job requirements...</p>
        </div>
      ) : appError ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] border border-rose-200 bg-rose-50/20 rounded-2xl p-8 text-center max-w-2xl mx-auto">
          <AlertCircle className="h-10 w-10 text-rose-600 mb-4 animate-bounce" />
          <h2 className="text-lg font-bold text-rose-900">Application Retrieval Failure</h2>
          <p className="text-xs text-rose-600 mt-1 max-w-md">{appError}</p>
          <a
            href="/"
            className="mt-6 px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-all"
          >
            Return to Dashboard
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 4. Terminal Console Log panel */}
          <div className="border border-slate-800 bg-slate-950 rounded-xl overflow-hidden shadow-md">
            <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 border-b border-slate-800">
              <Terminal className="h-4 w-4 text-slate-400" />
              <span className="font-mono text-xs text-slate-400 font-bold uppercase tracking-wider">Sidecar logs console</span>
              <div className="flex gap-1.5 ml-auto">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
              </div>
            </div>
            <div className="p-4 font-mono text-[11px] text-slate-300 space-y-1 max-h-[140px] overflow-y-auto leading-relaxed">
              {logs.length === 0 ? (
                <span className="text-slate-500 italic">No console logs streams registered yet...</span>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={
                    log.includes('[ERROR]') ? 'text-rose-400 font-bold' : 
                    log.includes('[WARNING]') ? 'text-amber-400' : 
                    log.includes('[INFO]') ? 'text-indigo-300' : 'text-slate-300'
                  }>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left Pane: Inputs Block */}
            <div className="flex flex-col border border-slate-200/80 rounded-2xl bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Application Inputs
                </h3>
                {analyzed && (
                  <button
                    onClick={() => {
                      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
                      if (appDetails?.user_id) {
                        fetch(`${backendUrl}/api/v1/users/${appDetails.user_id}/resume`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ base_resume_text: resumeText })
                        }).catch(console.error);
                      }
                      triggerOptimization(resumeText, jobDescription);
                    }}
                    disabled={isAnalyzing || !jobDescription.trim() || !resumeText.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-md transition-all"
                  >
                    <RefreshCw className={`h-3 w-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                    Re-run Optimizer
                  </button>
                )}
              </div>
              
              <div className="flex flex-col flex-1 space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Base Resume Text</label>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="w-full min-h-[200px] border border-slate-200 rounded-xl p-4 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed text-slate-700"
                  placeholder="Paste your base resume text here..."
                />
              </div>

              <div className="flex flex-col flex-1 space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Job Description Requirements</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full min-h-[200px] border border-slate-200 rounded-xl p-4 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed text-slate-700"
                  placeholder="Paste targeted job description details here..."
                />
              </div>

              {!analyzed && (
                  <button
                    onClick={() => {
                      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
                      if (appDetails?.user_id) {
                        fetch(`${backendUrl}/api/v1/users/${appDetails.user_id}/resume`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ base_resume_text: resumeText })
                        }).catch(console.error);
                      }
                      triggerOptimization(resumeText, jobDescription);
                    }}
                    disabled={isAnalyzing || !jobDescription.trim() || !resumeText.trim()}
                    className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 rounded-lg transition-all"
                  >
                    <Sparkles className="h-4 w-4" />
                    Run Tailoring Engine
                  </button>
              )}
            </div>

            {/* Right Pane: Optimization Output */}
            <div className="flex flex-col">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center min-h-[350px] border border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
                  <div className="relative flex items-center justify-center mb-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-indigo-600"></div>
                    <Sparkles className="absolute h-5 w-5 text-indigo-600 animate-pulse" />
                  </div>
                  <h3 className="font-extrabold text-slate-800 animate-pulse">Running Tailoring Engine</h3>
                  <p className="text-xs text-slate-500 text-center max-w-xs mt-1">
                    Surgically rephrasal experience bullets using context-bounded LLM models...
                  </p>
                </div>
              ) : analysisError ? (
                <div className="flex flex-col items-center justify-center min-h-[350px] border border-rose-200 bg-rose-50/10 rounded-2xl p-6 text-center shadow-sm">
                  <AlertCircle className="h-8 w-8 text-rose-500 mb-3 animate-pulse" />
                  <h3 className="font-extrabold text-rose-900">Optimization Pipeline Failed</h3>
                  <p className="text-xs text-rose-600 mt-1 max-w-xs">{analysisError}</p>
                  <button
                    onClick={() => triggerOptimization(resumeText, jobDescription)}
                    className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-all"
                  >
                    Retry Pipeline
                  </button>
                </div>
              ) : analyzed && originalScore && tailoredScore ? (
                <div className="space-y-6">
                  {/* ATS Scores mapping */}
                  <ScoreCard original={originalScore} tailored={tailoredScore} />

                  {/* Skill matrix gaps */}
                  {identifiedGaps.length > 0 && (
                    <GapAnalysis gaps={identifiedGaps} />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[350px] border border-dashed border-slate-300 bg-slate-50/20 rounded-2xl p-6 text-center">
                  <FileText className="h-8 w-8 text-slate-400 mb-2" />
                  <h3 className="font-bold text-slate-700">Ready for Ingest</h3>
                  <p className="text-xs text-slate-500 mt-1">Make sure you have both resume and JD context input to compile.</p>
                </div>
              )}
            </div>
          </div>

          {/* 5. Bullet diff review grid */}
          {analyzed && originalResume && tailoredResume && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  Bullet Surgeon Side-by-Side Review
                </h3>
                <span className="text-xs text-slate-400">Uncheck bullets to preserve original CV achievements</span>
              </div>
              
              <SideBySideDiff 
                original={originalResume} 
                tailored={tailoredResume} 
                acceptedBullets={acceptedBullets}
                onToggleBullet={handleToggleBullet}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
