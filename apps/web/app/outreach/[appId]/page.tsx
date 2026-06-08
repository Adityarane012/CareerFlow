'use client';

import React, { useState, useEffect, use } from 'react';
import { 
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Mail,
  Send,
  FolderPlus,
  Terminal,
  RefreshCw,
  Edit3
} from 'lucide-react';

interface PageProps {
  params: Promise<{ appId: string }>;
}

export default function OutreachComposerPage({ params }: PageProps) {
  const { appId } = use(params);

  // Core app data
  const [appDetails, setAppDetails] = useState<any>(null);
  const [isLoadingApp, setIsLoadingApp] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);

  // Email state variables
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('Hiring Manager');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [personalizationNote, setPersonalizationNote] = useState('');

  // Status and logs
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // 1. Load application context from backend
  useEffect(() => {
    async function loadApplication() {
      setIsLoadingApp(true);
      setAppError(null);
      addLog(`Loading application context for ID: ${appId}...`);

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        const res = await fetch(`${backendUrl}/api/v1/applications/${appId}`);
        
        if (!res.ok) {
          throw new Error(`Server returned status code: ${res.status}`);
        }

        const data = await res.json();
        setAppDetails(data);
        addLog(`Successfully loaded application: ${data.job_title} at ${data.company}.`);

        // Trigger automatic email generation if we have resume details
        if (data.tailored_resume_text || data.base_resume_text) {
          handleGenerateEmail(data.application_id, '');
        } else {
          addLog(`[WARNING] No resume text available. Please paste a base resume first.`);
        }
      } catch (err) {
        console.error(err);
        const errMsg = (err as Error).message || 'Failed to fetch application details.';
        setAppError(errMsg);
        addLog(`[ERROR] Loading application details failed: ${errMsg}`);
      } finally {
        setIsLoadingApp(false);
      }
    }

    loadApplication();
  }, [appId]);

  // 2. Generate customized email
  const handleGenerateEmail = async (targetAppId: string, note: string) => {
    setIsGenerating(true);
    setDispatchStatus(null);
    addLog(`Constructing personalized outreach email via Groq API (Llama 3.3)...`);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/api/v1/outreach/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: targetAppId,
          personalization_note: note
        })
      });

      if (!res.ok) {
        throw new Error('Groq email composition request failed.');
      }

      const data = await res.json();
      setSubject(data.subject || '');
      setBody(data.body || '');
      setRecipientEmail(data.recipient_email || 'recruiting@company.com');
      setRecipientName(data.recipient_name || 'Hiring Manager');
      addLog(`Email generated successfully. Subject: "${data.subject}"`);
      addLog(`Fit: Converted custom bullets and credentials into email body context.`);
    } catch (err) {
      console.error(err);
      addLog(`[ERROR] Email generation failed. Using template backup fallback.`);
      // Deterministic fallback template manually inside UI
      const role = appDetails?.job_title || 'Software Developer';
      const company = appDetails?.company || 'Company';
      setSubject(`Outreach: ${role} opportunity at ${company}`);
      setBody(`Hi Hiring Manager,\n\nI noticed that ${company} is hiring for the ${role} role${note ? `, and I ${note}` : ''}.\n\nI wanted to reach out because the work your team is doing aligns perfectly with my background. Would you be open to a brief 10-minute chat next week to discuss how my skill set might fit the needs of this role?\n\nBest regards,\nCandidate`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Dispatch (SMTP send or IMAP draft save)
  const handleDispatch = async (dispatchType: 'SMTP_SEND' | 'IMAP_DRAFT') => {
    setIsDispatching(true);
    setDispatchStatus(null);
    addLog(`Initiating dispatch via ${dispatchType === 'SMTP_SEND' ? 'SMTP STARTTLS port 587' : 'IMAP SSL port 993'}...`);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/api/v1/outreach/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: appId,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          subject,
          body,
          dispatch_type: dispatchType
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Dispatch endpoint returned failure.');
      }

      if (data.status === 'failed') {
        throw new Error(data.error_message || 'Mail dispatch server failed.');
      }

      const successMsg = dispatchType === 'SMTP_SEND' 
        ? `Email successfully sent to ${recipientEmail}!` 
        : `Draft appended to folder.`;
        
      addLog(`[SUCCESS] Dispatch status: ${data.status.toUpperCase()}`);
      if (data.error_message) {
        addLog(`[WARNING] Fallback warning: ${data.error_message}`);
      }
      
      setDispatchStatus({
        type: 'success',
        message: successMsg + (data.error_message ? ` Note: ${data.error_message}` : '')
      });

      // Update local status
      setAppDetails((prev: any) => ({
        ...prev,
        status: data.application_status
      }));

    } catch (err) {
      console.error(err);
      const errMsg = (err as Error).message || 'Outreach dispatch failed.';
      setDispatchStatus({
        type: 'error',
        message: errMsg
      });
      addLog(`[ERROR] Dispatch crashed: ${errMsg}`);
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <a
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-all mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </a>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Outreach Console
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure, personalize, and dispatch cold emails for your applications.
          </p>
        </div>
        {appDetails && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Pipeline Status:</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {appDetails.status}
            </span>
          </div>
        )}
      </div>

      {/* 2. Dispatch Status banners */}
      {dispatchStatus && (
        <div className={`mb-6 flex items-start gap-3 border rounded-xl p-4 text-sm ${
          dispatchStatus.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {dispatchStatus.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <strong className="block font-bold">
              {dispatchStatus.type === 'success' ? 'Outreach Dispatch Done' : 'Dispatch Failure'}
            </strong>
            <span className="leading-relaxed mt-0.5 block">{dispatchStatus.message}</span>
          </div>
        </div>
      )}

      {/* 3. Ingestion State */}
      {isLoadingApp ? (
        <div className="flex flex-col items-center justify-center min-h-[350px] border border-slate-200 bg-white rounded-2xl p-8">
          <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mb-4" />
          <h2 className="text-lg font-bold text-slate-800">Loading Application Context</h2>
          <p className="text-xs text-slate-500 mt-1">Fetching recruiter contacts and tailored resume copy...</p>
        </div>
      ) : appError ? (
        <div className="flex flex-col items-center justify-center min-h-[350px] border border-rose-200 bg-rose-50/20 rounded-2xl p-8 text-center max-w-2xl mx-auto">
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
          {/* 4. Connection Logs Console */}
          <div className="border border-slate-800 bg-slate-950 rounded-xl overflow-hidden shadow-md">
            <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 border-b border-slate-800">
              <Terminal className="h-4 w-4 text-slate-400" />
              <span className="font-mono text-xs text-slate-400 font-bold uppercase tracking-wider">Outreach server logs</span>
              <div className="flex gap-1.5 ml-auto">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
              </div>
            </div>
            <div className="p-4 font-mono text-[11px] text-slate-300 space-y-1 max-h-[120px] overflow-y-auto leading-relaxed">
              {logs.length === 0 ? (
                <span className="text-slate-500 italic">No connection log events recorded...</span>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={
                    log.includes('[ERROR]') ? 'text-rose-400 font-bold' : 
                    log.includes('[SUCCESS]') ? 'text-emerald-400 font-bold' : 
                    log.includes('[WARNING]') ? 'text-amber-400' : 'text-slate-300'
                  }>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Col: Composer fields */}
            <div className="lg:col-span-2 space-y-4 border border-slate-200/80 rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 uppercase tracking-wider">
                Email Composer
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Recipient Email</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full min-h-[260px] border border-slate-200 rounded-lg p-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 leading-relaxed"
                />
              </div>

              {/* Action buttons bar */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-6">
                <a
                  href="/"
                  className="px-4 py-2.5 text-xs font-semibold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg transition-all"
                >
                  Discard
                </a>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleDispatch('IMAP_DRAFT')}
                    disabled={isDispatching || isGenerating || !body.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
                  >
                    {isDispatching ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FolderPlus className="h-3.5 w-3.5" />
                    )}
                    Save Draft (IMAP)
                  </button>
                  <button
                    onClick={() => handleDispatch('SMTP_SEND')}
                    disabled={isDispatching || isGenerating || !body.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300/80 rounded-lg transition-all"
                  >
                    {isDispatching ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Send Email (SMTP)
                  </button>
                </div>
              </div>
            </div>

            {/* Right Col: Personalization widget */}
            <div className="space-y-4">
              <div className="border border-slate-200/80 rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 uppercase tracking-wider">
                  Outreach Personalizer
                </h3>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Personalization Hook Info
                </label>
                <textarea
                  value={personalizationNote}
                  onChange={(e) => setPersonalizationNote(e.target.value)}
                  className="w-full min-h-[100px] border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 leading-relaxed mb-4"
                  placeholder="e.g. read your recent blog post on engineering practices, or saw your talk on AI Sidecars..."
                />
                <button
                  onClick={() => handleGenerateEmail(appDetails.application_id, personalizationNote)}
                  disabled={isGenerating || isDispatching}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all"
                >
                  {isGenerating ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Edit3 className="h-3.5 w-3.5" />
                  )}
                  {isGenerating ? 'Generating Email...' : 'Generate New Copy'}
                </button>
              </div>

              <div className="border border-slate-200/80 rounded-2xl bg-slate-50/40 p-6">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Recruiter Context</h4>
                <div className="space-y-2.5 font-sans text-xs">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Target Job</div>
                    <div className="font-semibold text-slate-700">{appDetails?.job_title}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Target Company</div>
                    <div className="font-semibold text-slate-700">{appDetails?.company}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Ingest URL</div>
                    <a 
                      href={appDetails?.url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="font-medium text-indigo-600 hover:underline inline-flex items-center gap-0.5 shrink-0 break-all"
                    >
                      {appDetails?.url}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
