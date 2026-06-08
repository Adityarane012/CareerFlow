import { z } from 'zod';

// ==========================================
// Helpers for Robust Null/Undefined Handling
// ==========================================
const nullableString = z.preprocess(
  (val) => (val === null ? undefined : val),
  z.string().optional()
);

const nullableStringWithDefault = (defaultValue: string) => z.preprocess(
  (val) => (val === null ? undefined : val),
  z.string().optional().default(defaultValue)
);

// ==========================================
// 1. Core Resume Data Model Schemas
// ==========================================

export const WorkExperienceSchema = z.object({
  id: z.string().min(1, "Experience GUID is required"),
  company: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val : 'Not Specified'),
    z.string().min(1, "Company name is required")
  ),
  title: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val : 'Not Specified'),
    z.string().min(1, "Job title is required")
  ),
  location: nullableString,
  startDate: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val : 'Not Specified'),
    z.string().min(1, "Start date is required")
  ),
  endDate: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val : 'Present'),
    z.string().min(1)
  ).default("Present"),
  bullets: z.array(z.string().min(1, "Bullet content cannot be empty")).default([])
});

export const ProjectDetailSchema = z.object({
  name: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val : 'Unnamed Project'),
    z.string().min(1, "Project name is required")
  ),
  description: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val : 'No description provided'),
    z.string().min(1, "Project description is required")
  ),
  bullets: z.array(z.string().min(1)).default([]),
  technologiesUsed: z.array(z.string()).default([]),
  projectUrl: z.preprocess(
    (val) => {
      if (typeof val !== 'string' || val.trim() === '') return undefined;
      try {
        new URL(val);
        return val;
      } catch {
        return undefined;
      }
    },
    z.string().url("Invalid URL format").optional()
  )
});

export const EducationDetailSchema = z.object({
  institution: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val : 'Not Specified'),
    z.string().min(1, "Institution name is required")
  ),
  degree: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val : 'Not Specified'),
    z.string().min(1, "Degree name is required")
  ),
  fieldOfStudy: nullableString,
  graduationDate: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val : 'Not Specified'),
    z.string().min(1, "Graduation date is required")
  ),
  gpa: nullableString
});

export const ResumeProfileSchema = z.object({
  contact: z.object({
    fullName: z.preprocess(
      (val) => {
        if (val === undefined) return undefined;
        return typeof val === 'string' && val.trim() !== '' ? val : 'Professional Candidate';
      },
      z.string().min(1, "Full name is required")
    ),
    email: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() !== '' ? val : 'placeholder@example.com'),
      z.string().email("Invalid email format")
    ),
    phone: nullableString,
    location: nullableString,
    websiteUrls: z.preprocess(
      (val) => {
        if (!Array.isArray(val)) return [];
        return val.filter(u => {
          try {
            new URL(u);
            return true;
          } catch {
            return false;
          }
        });
      },
      z.array(z.string().url("Invalid URL format")).default([])
    )
  }),
  summary: nullableStringWithDefault(""),
  skills: z.array(z.string()).default([]),
  experience: z.array(WorkExperienceSchema).default([]),
  projects: z.array(ProjectDetailSchema).default([]),
  education: z.array(EducationDetailSchema).default([]),
  certifications: z.array(z.string()).default([])
});

// ==========================================
// 2. Job Description Schema
// ==========================================

export const JobDescriptionProfileSchema = z.object({
  jobTitle: z.string().min(1, "Job title is required"),
  company: nullableString,
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  qualifications: z.array(z.string()).default([]),
  toolsAndTech: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  seniorityLevel: z.enum(['Entry', 'Mid', 'Senior', 'Lead', 'Executive', 'Not Specified']).default('Not Specified')
});

// ==========================================
// 3. Match Engine Output Schemas
// ==========================================

export const MatchScoreSchema = z.object({
  overallScore: z.coerce.number().min(0).max(100),
  skillCoverageScore: z.coerce.number().min(0).max(100),
  responsibilityAlignmentScore: z.coerce.number().min(0).max(100),
  keywordScore: z.coerce.number().min(0).max(100),
  seniorityScore: z.coerce.number().min(0).max(100),
  criticalMissingRequirements: z.array(z.string()).default([]),
  explanation: z.string().min(1, "Score explanation is required")
});

// ==========================================
// 4. Tailoring Engine Output Schemas
// ==========================================

export const TailoredBulletSchema = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      return {
        original: val,
        tailored: val,
        changeReason: "Preserved original experience to maintain complete truthfulness and document integrity.",
        keywordsAddressed: [],
        confidence: "high",
        riskFlag: null
      };
    }
    if (val && typeof val === 'object') {
      const obj = val as any;
      const original = typeof obj.original === 'string' && obj.original.trim() !== '' ? obj.original : 'Original experience bullet';
      const tailored = typeof obj.tailored === 'string' && obj.tailored.trim() !== '' ? obj.tailored : original;
      const changeReason = typeof obj.changeReason === 'string' && obj.changeReason.trim() !== '' 
        ? obj.changeReason 
        : (tailored === original 
            ? "Preserved original experience to maintain complete truthfulness and document integrity."
            : "Tailored to align with target job description.");
      
      return {
        ...obj,
        original,
        tailored,
        changeReason
      };
    }
    return val;
  },
  z.object({
    original: z.string().min(1, "Original bullet is required"),
    tailored: z.string().min(1, "Tailored bullet is required"),
    changeReason: z.string().min(1, "Change reason is required"),
    keywordsAddressed: z.array(z.string()).default([]),
    confidence: z.enum(['high', 'medium', 'low']).default('medium'),
    riskFlag: z.string().nullable().default(null)
  })
);

export const TailoredWorkExperienceSchema = z.object({
  company: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val : 'Not Specified'),
    z.string().min(1, "Company name is required")
  ),
  title: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val : 'Not Specified'),
    z.string().min(1, "Job title is required")
  ),
  bullets: z.array(TailoredBulletSchema).default([])
});

export const TailoredResumeSchema = z.object({
  tailoredSummary: nullableStringWithDefault(""),
  tailoredSkills: z.array(z.string()).default([]),
  tailoredExperience: z.array(TailoredWorkExperienceSchema).default([])
});

// ==========================================
// 5. Gap Analysis Schemas
// ==========================================

export const ResumeGapSchema = z.object({
  name: z.string().min(1, "Gap name is required"),
  importance: z.enum(['high', 'medium', 'low']).default('medium'),
  jdEvidence: z.string().min(1, "Evidence context is required"),
  resumeEvidence: z.string().default("Not mentioned"),
  suggestedAction: z.enum([
    'Add if you have this experience',
    'Leave out if not true',
    'Mention in skills section if familiar',
    'Add a project bullet if applicable',
    'Prepare to address this in interview'
  ]),
  canSafelyAdd: z.boolean().default(false)
});

// ==========================================
// 6. Complete Session Manifest
// ==========================================

export const TailoringRunSchema = z.object({
  runId: z.string().uuid().or(z.string()),
  createdAt: z.string().datetime().or(z.string()),
  originalResume: ResumeProfileSchema,
  targetJobDescription: JobDescriptionProfileSchema,
  originalScore: MatchScoreSchema,
  tailoredScore: MatchScoreSchema,
  tailoredResume: TailoredResumeSchema,
  identifiedGaps: z.array(ResumeGapSchema).default([])
});

// ==========================================
// Extraction of TypeScript Types (Contracts)
// ==========================================

export type WorkExperience = z.infer<typeof WorkExperienceSchema>;
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;
export type EducationDetail = z.infer<typeof EducationDetailSchema>;
export type ResumeProfile = z.infer<typeof ResumeProfileSchema>;
export type JobDescriptionProfile = z.infer<typeof JobDescriptionProfileSchema>;
export type MatchScore = z.infer<typeof MatchScoreSchema>;
export type TailoredBullet = z.infer<typeof TailoredBulletSchema>;
export type TailoredWorkExperience = z.infer<typeof TailoredWorkExperienceSchema>;
export type TailoredResume = z.infer<typeof TailoredResumeSchema>;
export type ResumeGap = z.infer<typeof ResumeGapSchema>;
export type TailoringRun = z.infer<typeof TailoringRunSchema>;
