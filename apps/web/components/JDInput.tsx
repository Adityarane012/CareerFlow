'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

interface JDInputProps {
  /** Current text value of the JD textarea */
  value: string;
  /** Called whenever the textarea content changes */
  onChange: (text: string) => void;
}

/**
 * JDInput
 *
 * Self-contained card for pasting or typing the target Job Description.
 * Intentionally simple — no file upload, no async logic.
 * All state is controlled by the parent (app/page.tsx).
 */
export const JDInput: React.FC<JDInputProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm min-h-[450px]">
      {/* ── Card Header ── */}
      <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
        <Sparkles className="h-5 w-5 text-indigo-600" />
        <h2 className="text-base font-bold text-slate-800">Target Job Description</h2>
      </div>

      {/* ── Tips row ── */}
      <div className="flex items-center gap-3 mb-3">
        {['Required skills', 'Responsibilities', 'Qualifications'].map((tip) => (
          <span
            key={tip}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100"
          >
            {tip}
          </span>
        ))}
        <span className="text-[10px] text-slate-400 ml-auto italic">Include as much as possible</span>
      </div>

      {/* ── Textarea ── */}
      <textarea
        id="jd-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste the full job description here — include required skills, responsibilities, qualifications, and any technology mentions for best results."
        required
        className="flex-1 min-h-[350px] w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-mono text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all resize-none"
      />

      {/* ── Character count hint ── */}
      <p className="mt-1.5 text-[10px] text-slate-400 text-right">
        {value.length.toLocaleString()} characters
        {value.length < 200 && value.length > 0 && (
          <span className="ml-2 text-amber-500 font-semibold">
            · More detail = better tailoring
          </span>
        )}
      </p>
    </div>
  );
};
