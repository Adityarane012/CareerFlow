'use client';

import React, { useState, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  FileCheck2,
  Trash2,
  AlertCircle,
} from 'lucide-react';

interface ResumeInputProps {
  /** Current text value of the resume textarea */
  value: string;
  /** Called whenever the textarea content changes */
  onChange: (text: string) => void;
  /** Called when a file is dropped or selected — parent handles the API call */
  onFileUpload: (file: File) => Promise<void>;
  /** Called when the user clicks the remove-file (trash) button */
  onRemoveFile: () => void;
  /** Called when the user clicks "Load Sample Data" */
  onLoadSample: () => void;
  /** The name of the last successfully parsed file, or null */
  parsedFileName: string | null;
  /** True while the /api/parse/resume call is in flight */
  isParsingFile: boolean;
  /** Error message from a failed parse attempt, or null */
  parseError: string | null;
  /** Called to dismiss the parse error banner */
  onDismissError: () => void;
}

/**
 * ResumeInput
 *
 * Self-contained card that handles:
 *  - Drag-and-drop file upload zone (.pdf / .docx / .txt)
 *  - Hidden <input type="file"> (ref managed internally)
 *  - Parsing spinner while /api/parse/resume is in flight
 *  - Parse error banner with dismiss action
 *  - Filename success banner when parsing succeeds
 *  - Editable <textarea> for the extracted (or manually pasted) resume text
 *
 * Drag state is managed internally — it is purely a UI concern of this component.
 */
export const ResumeInput: React.FC<ResumeInputProps> = ({
  value,
  onChange,
  onFileUpload,
  onRemoveFile,
  onLoadSample,
  parsedFileName,
  isParsingFile,
  parseError,
  onDismissError,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Drag Handlers ───────────────────────────────────────────────────────

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await onFileUpload(e.target.files[0]);
    }
  };

  // ─── Derived booleans for conditional rendering ───────────────────────────

  const showDropZone = !parsedFileName && !value && !isParsingFile;
  const showPreview  = (parsedFileName || value) && !isParsingFile;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm min-h-[450px]">
      {/* ── Card Header ── */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-800">Your Resume Context</h2>
        </div>
        <button
          type="button"
          onClick={onLoadSample}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          Load Sample Data
        </button>
      </div>

      {/* ── Drag-and-Drop Zone (shown only when no file/text yet) ── */}
      {showDropZone && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all min-h-[300px] ${
            dragActive
              ? 'border-indigo-600 bg-indigo-50/50 scale-[1.01]'
              : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.docx,.txt"
            className="hidden"
            id="resume-file-input"
          />
          <UploadCloud
            className={`h-12 w-12 mb-4 transition-all duration-200 ${
              dragActive ? 'text-indigo-600 scale-110' : 'text-slate-400'
            }`}
          />
          <p className="text-sm font-bold text-slate-700 text-center">
            Drag and drop your resume file here
          </p>
          <p className="text-xs text-slate-400 mt-1.5 text-center">
            Supports .pdf, .docx, and .txt formats
          </p>
          <div className="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-all">
            Or select file from device
          </div>
        </div>
      )}

      {/* ── Parsing Spinner ── */}
      {isParsingFile && (
        <div className="flex flex-col items-center justify-center border border-slate-200 bg-slate-50/50 rounded-xl p-8 min-h-[300px]">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600 mb-4" />
          <h3 className="text-sm font-bold text-slate-700">Extracting Document Text</h3>
          <p className="text-xs text-slate-400 mt-1 italic max-w-xs text-center truncate">
            Parsing {parsedFileName}...
          </p>
        </div>
      )}

      {/* ── Parse Error Banner ── */}
      {parseError && (
        <div className="mb-4 flex items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-bold">Extraction Warning</strong>
            <span className="leading-relaxed mt-0.5 block">{parseError}</span>
            <button
              type="button"
              onClick={onDismissError}
              className="mt-2 text-rose-600 hover:text-rose-800 font-bold underline"
            >
              Dismiss and paste manually
            </button>
          </div>
        </div>
      )}

      {/* ── File Success Banner + Textarea ── */}
      {showPreview && (
        <div className="flex flex-col flex-1">
          {/* Filename success pill */}
          {parsedFileName && (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-xs">
              <div className="flex items-center gap-2 text-emerald-800">
                <FileCheck2 className="h-4 w-4 text-emerald-600" />
                <span className="font-bold truncate max-w-[200px]">{parsedFileName}</span>
                <span className="text-[10px] text-emerald-600 font-medium">
                  Successfully Extracted
                </span>
              </div>
              <button
                type="button"
                onClick={onRemoveFile}
                className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-md"
                title="Remove file and start over"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Editable textarea */}
          <textarea
            id="resume-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Extracted resume text appears here. You can also paste directly."
            required
            className="flex-1 min-h-[250px] w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-mono text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all resize-none"
          />

          {/* Character count hint */}
          <p className="mt-1.5 text-[10px] text-slate-400 text-right">
            {value.length.toLocaleString()} characters
          </p>
        </div>
      )}
    </div>
  );
};
