'use client';

import React, { useState } from 'react';
import { TailoredResume, ResumeProfile, TailoredBullet } from '../lib/types';

interface DiffProps {
  original: ResumeProfile;
  tailored: TailoredResume;
  acceptedBullets?: Record<string, boolean>;
  onToggleBullet?: (jobIdx: number, bulletIdx: number) => void;
}

const confidenceColors: Record<string, string> = {
  high: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

interface BulletPopoverProps {
  bullet: TailoredBullet;
  isOpen: boolean;
  onToggle: () => void;
  isChecked: boolean;
  onCheckToggle: (e: React.MouseEvent) => void;
  showCheckbox: boolean;
}

const BulletCard: React.FC<BulletPopoverProps> = ({ 
  bullet, 
  isOpen, 
  onToggle, 
  isChecked, 
  onCheckToggle,
  showCheckbox 
}) => {
  const isChanged = bullet.original !== bullet.tailored;

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCheckToggle(e);
  };

  return (
    <li
      className={`relative p-3 rounded-xl border cursor-pointer transition-all duration-200 select-none
        ${isOpen
          ? 'bg-emerald-50/80 border-emerald-300/70 shadow-sm'
          : isChanged
            ? 'bg-emerald-50/20 border-emerald-100/50 hover:bg-emerald-50/60 hover:border-emerald-200/70'
            : 'bg-slate-50/30 border-slate-200/40 hover:bg-slate-50/70 hover:border-slate-200/80'
        }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-2.5">
        {showCheckbox && (
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => {}}
            onClick={handleCheckboxClick}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        )}
        <div className="flex-1">
          {isChanged ? (
            <>
              {/* Strike-through original */}
              <div className="line-through text-slate-400 text-[11px] mb-1.5 leading-relaxed">
                {bullet.original}
              </div>

              {/* Tailored text */}
              <div className="font-medium text-slate-800 text-xs leading-relaxed">
                {bullet.tailored}
              </div>
            </>
          ) : (
            /* Preserved original text unchanged */
            <div className="font-medium text-slate-700 text-xs leading-relaxed">
              {bullet.original}
            </div>
          )}

          {/* Inline confidence badge */}
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
              isChanged
                ? (confidenceColors[bullet.confidence] || confidenceColors.medium)
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              {isChanged ? bullet.confidence : 'PRESERVED'}
            </span>
            {bullet.riskFlag && (
              <span className="text-[9px] text-amber-600 font-semibold">⚠ Risk Flag</span>
            )}
            <span className="ml-auto text-[9px] text-slate-400 italic">
              {isOpen ? 'click to collapse' : 'click to inspect'}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded detail panel */}
      {isOpen && (
        <div className="mt-3 pt-3 border-t border-emerald-200/60 space-y-2.5">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Change Rationale
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              {bullet.changeReason}
            </p>
          </div>

          {bullet.keywordsAddressed.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Keywords Addressed
              </div>
              <div className="flex flex-wrap gap-1">
                {bullet.keywordsAddressed.map((kw, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {bullet.riskFlag && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <span className="text-amber-500 text-sm shrink-0 mt-0.5">⚠</span>
              <div>
                <div className="text-[10px] font-bold text-amber-700 mb-0.5">Risk Alert</div>
                <p className="text-[10px] text-amber-700 leading-relaxed">{bullet.riskFlag}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
};

export const SideBySideDiff: React.FC<DiffProps> = ({ 
  original, 
  tailored,
  acceptedBullets,
  onToggleBullet
}) => {
  const [openBullet, setOpenBullet] = useState<string | null>(null);

  const toggleBullet = (key: string) => {
    setOpenBullet(prev => (prev === key ? null : key));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-md">
      {/* ─── Left Column: Original ─── */}
      <div className="p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/40">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-6 pb-3 border-b border-slate-100">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400 shrink-0" />
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Original Document
          </h3>
          <span className="ml-auto text-[10px] text-slate-400 font-medium">
            {original.experience.reduce((acc, j) => acc + j.bullets.length, 0)} bullets
          </span>
        </div>

        {/* Experience blocks */}
        {original.experience.map((job) => (
          <div key={job.id} className="mb-8 last:mb-0">
            <h4 className="font-bold text-slate-800 text-sm leading-snug">{job.title}</h4>
            <div className="text-[11px] font-semibold text-indigo-600 mt-0.5 mb-3">
              {job.company}
              {job.startDate && (
                <span className="text-slate-400 font-normal ml-2">
                  · {job.startDate} – {job.endDate || 'Present'}
                </span>
              )}
            </div>
            <ul className="list-disc list-outside ml-4 space-y-2.5 text-slate-600">
              {job.bullets.map((bullet, idx) => (
                <li key={idx} className="pl-1 leading-relaxed text-xs">
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Skills summary */}
        {original.skills.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Original Skills
            </div>
            <div className="flex flex-wrap gap-1">
              {original.skills.map((skill, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-medium border border-slate-200">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Right Column: Tailored ─── */}
      <div className="p-6 sm:p-8 bg-white">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-6 pb-3 border-b border-emerald-100">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
            Tailored Preview
          </h3>
          <span className="ml-auto text-[10px] text-slate-400 font-medium">
            Click bullets to inspect changes
          </span>
        </div>

        {/* Tailored experience blocks */}
        {tailored.tailoredExperience.map((job, jobIdx) => (
          <div key={jobIdx} className="mb-8 last:mb-0">
            <h4 className="font-bold text-slate-800 text-sm leading-snug">{job.title}</h4>
            <div className="text-[11px] font-semibold text-emerald-600 mt-0.5 mb-3">
              {job.company}
            </div>
            <ul className="space-y-2.5 list-none p-0 m-0">
              {job.bullets.map((bullet, bulletIdx) => {
                const key = `${jobIdx}-${bulletIdx}`;
                const showCheckbox = !!onToggleBullet && !!acceptedBullets;
                const isChecked = acceptedBullets ? acceptedBullets[key] !== false : true;
                return (
                  <BulletCard
                    key={key}
                    bullet={bullet}
                    isOpen={openBullet === key}
                    onToggle={() => toggleBullet(key)}
                    showCheckbox={showCheckbox}
                    isChecked={isChecked}
                    onCheckToggle={() => onToggleBullet && onToggleBullet(jobIdx, bulletIdx)}
                  />
                );
              })}
            </ul>
          </div>
        ))}

        {/* Tailored skills */}
        {tailored.tailoredSkills && tailored.tailoredSkills.length > 0 && (
          <div className="mt-6 pt-4 border-t border-emerald-100">
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">
              Recommended Skills
            </div>
            <div className="flex flex-wrap gap-1">
              {tailored.tailoredSkills.map((skill, i) => {
                const isNew = !original.skills.includes(skill);
                return (
                  <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    isNew
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {isNew && <span className="mr-1 text-emerald-500">+</span>}
                    {skill}
                  </span>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic">
              <span className="text-emerald-600 font-semibold not-italic">+</span> = newly recommended keyword
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
