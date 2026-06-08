'use client';

import React from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { TailoringRun } from '../lib/types';
import { printHtmlToPDF } from '../lib/client-pdf';

interface CleanResumeExportButtonProps {
  runData: TailoringRun | null;
}

export const CleanResumeExportButton: React.FC<CleanResumeExportButtonProps> = ({ runData }) => {
  const [isExporting, setIsExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleExport = async () => {
    if (!runData) return;
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch('/api/export/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runData),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate clean resume PDF.');
      }

      const { html } = await response.json();
      printHtmlToPDF(html);
    } catch (err) {
      setError((err as Error).message || 'Clean PDF generation failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleExport}
        disabled={isExporting || !runData}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed rounded-lg shadow-md hover:shadow-lg transition-all animate-pulse"
        title="Download a clean, recruiters-ready, portrait A4 tailored resume PDF"
      >
        {isExporting ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {isExporting ? 'Generating Resume...' : 'Generate Tailored Resume'}
      </button>
      {error && (
        <p className="text-[10px] text-rose-600 font-semibold">{error}</p>
      )}
    </div>
  );
};
