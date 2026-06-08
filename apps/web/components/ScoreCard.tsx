'use client';

import React from 'react';
import { MatchScore } from '../lib/types';

interface ScoreCardProps {
  original: MatchScore;
  tailored: MatchScore;
}

interface RadialMeterProps {
  score: number;
  color: string;
  size?: number;
}

const RadialMeter: React.FC<RadialMeterProps> = ({ score, color, size = 80 }) => {
  const r = (size / 2) - 7;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - score / 100);
  const cx = size / 2;

  return (
    <svg width={size} height={size} className="transform -rotate-90 shrink-0">
      <circle cx={cx} cy={cx} r={r} className="stroke-slate-100" strokeWidth="6" fill="transparent" />
      <circle
        cx={cx} cy={cx} r={r}
        stroke={color}
        strokeWidth="6"
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  );
};

const SubScoreBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="space-y-1">
    <div className="flex justify-between items-center text-[11px]">
      <span className="text-slate-600 font-medium">{label}</span>
      <span className="font-bold text-slate-800">{value}%</span>
    </div>
    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

export const ScoreCard: React.FC<ScoreCardProps> = ({ original, tailored }) => {
  const improvement = tailored.overallScore - original.overallScore;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Original Score Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center shrink-0">
            <RadialMeter score={original.overallScore} color="#94a3b8" />
            <span className="absolute text-lg font-bold text-slate-500">
              {original.overallScore}%
            </span>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Before Tailoring</div>
            <h3 className="text-sm font-bold text-slate-700">Original Match Score</h3>
          </div>
        </div>

        {/* Sub-scores */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <SubScoreBar label="Skill Coverage" value={original.skillCoverageScore} color="#94a3b8" />
          <SubScoreBar label="Responsibility Alignment" value={original.responsibilityAlignmentScore} color="#94a3b8" />
          <SubScoreBar label="Keyword Density" value={original.keywordScore} color="#94a3b8" />
          <SubScoreBar label="Seniority Fit" value={original.seniorityScore} color="#94a3b8" />
        </div>

        {/* Explanation */}
        <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
          {original.explanation}
        </p>

        {/* Missing requirements */}
        {original.criticalMissingRequirements.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-2">Critical Gaps</div>
            <div className="flex flex-wrap gap-1">
              {original.criticalMissingRequirements.map((req, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                  {req}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tailored Score Panel */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/10 p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center shrink-0">
            <RadialMeter score={tailored.overallScore} color="#10b981" />
            <span className="absolute text-lg font-extrabold text-emerald-600">
              {tailored.overallScore}%
            </span>
          </div>
          <div>
            <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">After Tailoring</div>
            <h3 className="text-sm font-bold text-emerald-700">Tailored Match Score</h3>
            {improvement > 0 && (
              <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                ↑ +{improvement} points improvement
              </div>
            )}
          </div>
        </div>

        {/* Sub-scores */}
        <div className="space-y-3 pt-2 border-t border-emerald-100">
          <SubScoreBar label="Skill Coverage" value={tailored.skillCoverageScore} color="#10b981" />
          <SubScoreBar label="Responsibility Alignment" value={tailored.responsibilityAlignmentScore} color="#10b981" />
          <SubScoreBar label="Keyword Density" value={tailored.keywordScore} color="#10b981" />
          <SubScoreBar label="Seniority Fit" value={tailored.seniorityScore} color="#10b981" />
        </div>

        {/* Explanation */}
        <p className="text-xs text-emerald-800/80 leading-relaxed border-t border-emerald-100 pt-3">
          {tailored.explanation}
        </p>
      </div>
    </div>
  );
};
