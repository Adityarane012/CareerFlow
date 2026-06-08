'use client';

import React, { useState } from 'react';
import { ResumeGap } from '../lib/types';

interface GapAnalysisProps {
  gaps: ResumeGap[];
}

const importanceBadge: Record<string, { label: string; className: string }> = {
  high:   { label: 'High Priority',   className: 'bg-rose-50 text-rose-700 border-rose-100' },
  medium: { label: 'Medium Priority', className: 'bg-amber-50 text-amber-700 border-amber-100' },
  low:    { label: 'Low Priority',    className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const sortOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

export const GapAnalysis: React.FC<GapAnalysisProps> = ({ gaps }) => {
  const [filterImportance, setFilterImportance] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const sorted = [...gaps].sort(
    (a, b) => (sortOrder[a.importance] ?? 2) - (sortOrder[b.importance] ?? 2)
  );

  const filtered = filterImportance === 'all'
    ? sorted
    : sorted.filter(g => g.importance === filterImportance);

  const highCount   = gaps.filter(g => g.importance === 'high').length;
  const mediumCount = gaps.filter(g => g.importance === 'medium').length;
  const lowCount    = gaps.filter(g => g.importance === 'low').length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span className="text-indigo-600 text-lg">◎</span>
            JD Gap Analysis Matrix
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {gaps.length} skill gap{gaps.length !== 1 ? 's' : ''} identified
          </p>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-2 text-[11px] font-semibold">
          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
            {highCount} High
          </span>
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
            {mediumCount} Medium
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {lowCount} Low
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['all', 'high', 'medium', 'low'] as const).map(level => (
          <button
            key={level}
            onClick={() => setFilterImportance(level)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterImportance === level
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
      </div>

      {/* Gap rows */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm italic">
          No gaps found for the selected filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 pr-4 whitespace-nowrap">Requirement</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Priority</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Evidence from JD</th>
                <th className="py-2.5 pl-4 whitespace-nowrap">Suggested Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((gap, idx) => {
                const badge = importanceBadge[gap.importance] ?? importanceBadge.low;
                return (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="py-3 pr-4 font-semibold text-slate-900 align-top">
                      <div>{gap.name}</div>
                      {gap.resumeEvidence && (
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                          {gap.resumeEvidence}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 italic align-top max-w-[200px]">
                      &ldquo;{gap.jdEvidence}&rdquo;
                    </td>
                    <td className="py-3 pl-4 text-indigo-600 font-semibold align-top">
                      {gap.suggestedAction}
                      {gap.canSafelyAdd && (
                        <div className="mt-1 text-[10px] text-emerald-600 font-normal not-italic">
                          ✓ Safe to add if true
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Truthfulness guardrail notice */}
      <div className="flex items-start gap-2 bg-amber-50/50 border border-amber-200/50 rounded-xl p-3 text-xs text-amber-800">
        <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
        <p className="leading-relaxed">
          <strong>Truthfulness Guardrail:</strong> Under no circumstances will the tailoring engine invent
          experience or generate fake entries to fill gaps. Gaps must be manually addressed by you if
          you genuinely possess the required skills.
        </p>
      </div>
    </div>
  );
};
