'use client';

import React from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { TailoringRun } from '../lib/types';
import { printHtmlToPDF } from '../lib/client-pdf';

interface PDFExportButtonProps {
  runData: TailoringRun | null;
}

export const PDFExportButton: React.FC<PDFExportButtonProps> = ({ runData }) => {
  const [isExporting, setIsExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleExport = async () => {
    if (!runData) return;
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runData),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate PDF.');
      }

      const { html } = await response.json();
      printHtmlToPDF(html);
    } catch (err) {
      setError((err as Error).message || 'PDF generation failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleExport}
        disabled={isExporting || !runData}
        id="pdf-export-btn"
        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-md transition-all"
      >
        {isExporting ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {isExporting ? 'Generating PDF...' : 'Export Side-by-Side PDF'}
      </button>
      {error && (
        <p className="text-[10px] text-rose-600 font-semibold">{error}</p>
      )}
    </div>
  );
};
