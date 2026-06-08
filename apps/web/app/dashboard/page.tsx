'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  ArrowRight, 
  CheckCircle,
  FileText,
  Send,
  AlertCircle,
  Undo,
  Trash2
} from 'lucide-react';

interface ApplicationCard {
  application_id: string;
  user_id: string;
  job_id: string;
  status: string;
  job_title: string;
  company: string;
  location: string;
  url: string;
  ats_score: number | null;
  tailored_resume_url: string | null;
}

const statusColumns = [
  { key: 'SHORTLISTED', title: 'Shortlisted', color: 'border-t-indigo-500 bg-indigo-50/20' },
  { key: 'RESUME_TAILORED', title: 'Resume Tailored', color: 'border-t-amber-500 bg-amber-50/20' },
  { key: 'DRAFTED_IMAP', title: 'Drafted (IMAP)', color: 'border-t-blue-500 bg-blue-50/20' },
  { key: 'SENT_SMTP', title: 'Sent (SMTP)', color: 'border-t-emerald-500 bg-emerald-50/20' }
];

export default function KanbanDashboard() {
  const [applications, setApplications] = useState<ApplicationCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Discovery / Scraper panel states
  const [searchQuery, setSearchQuery] = useState('React developer');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<string | null>(null);
  const [scrapedJobs, setScrapedJobs] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  // Undo dropdown state
  const [showUndoDropdown, setShowUndoDropdown] = useState(false);

  // Active user profile credentials check
  const [userId, setUserId] = useState<string | null>(null);

  // Handle unshortlist / delete application
  const handleDeleteApplication = async (appId: string) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/api/v1/applications/${appId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchApplications();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to delete application: ${errData.detail || res.statusText || res.status}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to delete application: ${(err as Error).message}`);
    }
  };

  // Fetch all applications
  const fetchApplications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/api/v1/applications`);
      if (!res.ok) throw new Error('Failed to fetch applications.');
      const data = await res.json();
      setApplications(data);
    } catch (err) {
      console.error(err);
      setError((err as Error).message || 'Retrieval failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Seed standard candidate user on mount to simplify local dev
  const ensureUserSeeded = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const setupRes = await fetch(`${backendUrl}/api/v1/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@candidate.com',
          first_name: 'Aditya',
          last_name: 'Rane',
          smtp_password: 'dummy_pass'
        })
      });
      if (setupRes.ok) {
        const userData = await setupRes.json();
        setUserId(userData.user_id);
      }
    } catch (err) {
      console.error('Failed to seed user profiles:', err);
    }
  };

  useEffect(() => {
    ensureUserSeeded().then(() => {
      fetchApplications();
    });
  }, []);

  // Run scraper
  const handleScrape = async () => {
    if (!searchQuery.trim()) return;
    setIsScraping(true);
    setScrapeStatus('Scraper threads executing concurrently...');
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const scrapeRes = await fetch(`${backendUrl}/api/v1/jobs/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          platforms: ['remoteok', 'wellfound']
        })
      });
      if (!scrapeRes.ok) throw new Error('Scraping initialization failed.');
      const scrapeData = await scrapeRes.json();

      // Poll status
      const interval = setInterval(async () => {
        const statusRes = await fetch(`${backendUrl}/api/v1/jobs/scrape/${scrapeData.task_id}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setScrapeStatus(`Scraping Status: ${statusData.status}...`);
          if (statusData.status === 'completed') {
            clearInterval(interval);
            setIsScraping(false);
            setScrapeStatus(`Success! Found and saved ${statusData.jobs_found} unique jobs.`);
            loadJobsList();
          } else if (statusData.status === 'failed') {
            clearInterval(interval);
            setIsScraping(false);
            setScrapeStatus('Scrape execution failed.');
          }
        }
      }, 1500);

    } catch (err) {
      console.error(err);
      setScrapeStatus('Scraper execution crashed.');
      setIsScraping(false);
    }
  };

  // Load scraped job listings
  const loadJobsList = async () => {
    setIsLoadingJobs(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/api/v1/jobs`);
      if (res.ok) {
        const data = await res.json();
        setScrapedJobs(data.slice(0, 10)); // Limit to latest 10
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  useEffect(() => {
    loadJobsList();
  }, []);

  // Shortlist a job
  const handleShortlist = async (jobId: string) => {
    if (!userId) {
      alert('Seeding user, please try again...');
      return;
    }
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/api/v1/jobs/shortlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          job_id: jobId
        })
      });
      if (res.ok) {
        fetchApplications();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            CareerFlow Platform
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track job applications, surgically adapt resume bullets, and dispatch outreach drafts.
          </p>
        </div>
        <div className="flex items-center gap-3 relative">
          {/* Unshortlist / Undo Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUndoDropdown(!showUndoDropdown)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-all"
            >
              <Undo className="h-3.5 w-3.5" />
              Undo Shortlist
            </button>
            
            {showUndoDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase px-3 py-1 border-b border-slate-100">
                  Select Job to Unshortlist
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {applications.length === 0 ? (
                    <div className="text-xs text-slate-400 italic p-3 text-center">
                      No jobs shortlisted
                    </div>
                  ) : (
                    applications.map((app) => (
                      <div
                        key={app.application_id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-all text-left"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-[11px] font-bold text-slate-800 truncate">
                            {app.job_title}
                          </div>
                          <div className="text-[9px] text-slate-400 font-semibold truncate">
                            {app.company}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            handleDeleteApplication(app.application_id);
                            setShowUndoDropdown(false);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all shrink-0"
                          title="Unshortlist"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={fetchApplications}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync Dashboard
          </button>
        </div>
      </div>

      {/* Discovery Board Panel (Split Screen: Board on top/left, scraper on right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Scraper Control widget */}
        <div className="border border-slate-200/80 rounded-2xl bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 uppercase tracking-wider">
              Scraper Discovery Control
            </h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Job title (e.g. Python dev)..."
                className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-semibold"
              />
            </div>
            {scrapeStatus && (
              <p className="text-[10px] font-mono text-slate-500 mb-4 bg-slate-50 border border-slate-100 p-2 rounded leading-normal">
                {scrapeStatus}
              </p>
            )}
          </div>
          <button
            onClick={handleScrape}
            disabled={isScraping || !searchQuery.trim()}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
          >
            {isScraping ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isScraping ? 'Concurrent Scraping...' : 'Discover Jobs'}
          </button>
        </div>

        {/* Discovery Tabular Board */}
        <div className="lg:col-span-2 border border-slate-200/80 rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 uppercase tracking-wider">
            Scraped Job Discovery Board
          </h3>
          <div className="max-h-[220px] overflow-y-auto space-y-2">
            {isLoadingJobs ? (
              <p className="text-xs text-slate-500 italic text-center py-4">Loading discovered listings...</p>
            ) : scrapedJobs.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-4">No jobs discovered yet. Run scraper to search.</p>
            ) : (
              scrapedJobs.map((job) => {
                const isShortlisted = applications.some(app => app.job_id === job.id);
                return (
                  <div key={job.id} className="flex items-center justify-between p-3 border border-slate-100 hover:border-slate-200 rounded-xl transition-all">
                    <div>
                      <div className="text-xs font-bold text-slate-800">{job.title}</div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {job.company} · {job.location || 'Remote'} · <span className="font-mono">{job.platform}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleShortlist(job.id)}
                      disabled={isShortlisted}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                        isShortlisted 
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                      }`}
                    >
                      {isShortlisted ? 'Shortlisted' : 'Shortlist'}
                      {!isShortlisted && <ArrowRight className="h-3 w-3" />}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Kanban Board Layout */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] border border-slate-200 bg-white rounded-2xl p-8">
          <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mb-4" />
          <h3 className="font-bold text-slate-800">Synchronizing Application Board</h3>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] border border-rose-200 bg-rose-50/15 rounded-2xl p-8 text-center max-w-xl mx-auto">
          <AlertCircle className="h-10 w-10 text-rose-600 mb-4 animate-pulse" />
          <h3 className="font-bold text-rose-900">Board Connection Error</h3>
          <p className="text-xs text-rose-600 mt-1">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statusColumns.map((col) => {
            const colApps = applications.filter(app => {
              if (col.key === 'SHORTLISTED') {
                return app.status === 'SHORTLISTED' || app.status === 'DISCOVERED';
              }
              return app.status === col.key;
            });
            return (
              <div key={col.key} className="flex flex-col border border-slate-200 rounded-2xl bg-slate-50/30 overflow-hidden shadow-sm">
                {/* Column Title */}
                <div className={`px-4 py-3 border-t-4 ${col.color} border-b border-slate-200 flex items-center justify-between`}>
                  <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">{col.title}</h3>
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-full">
                    {colApps.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="p-3 flex-1 space-y-3 min-h-[300px] max-h-[500px] overflow-y-auto">
                  {colApps.length === 0 ? (
                    <div className="text-center py-12 text-[10px] text-slate-400 italic">
                      Empty column
                    </div>
                  ) : (
                    colApps.map((app) => (
                      <div key={app.application_id} className="border border-slate-200/80 hover:border-slate-300 rounded-xl bg-white p-4 shadow-sm space-y-3 transition-all">
                        <div>
                          <div className="text-xs font-bold text-slate-800 leading-snug">{app.job_title}</div>
                          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{app.company}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{app.location || 'Remote'}</div>
                        </div>

                        {app.ats_score !== null && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">ATS Score:</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                              app.ats_score >= 80 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {app.ats_score}/100
                            </span>
                          </div>
                        )}

                        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100">
                          <a
                            href={`/tailor/${app.application_id}`}
                            className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                          >
                            <FileText className="h-3 w-3" />
                            Resume Tailor
                          </a>
                          
                          {(app.status === 'RESUME_TAILORED' || app.status === 'DRAFTED_IMAP' || app.status === 'SENT_SMTP') && (
                            <a
                              href={`/outreach/${app.application_id}`}
                              className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all"
                            >
                              <Send className="h-3 w-3" />
                              Compose Outreach
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
