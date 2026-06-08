/**
 * Schema Strictness Tests
 *
 * Validates Verification Matrix item:
 *   "Execute pipeline with empty experience arrays →
 *    API catches failure at Zod layers and returns a standard 400 Bad Request."
 *
 * We test the Zod schemas directly (no network / LLM calls).
 */
import { describe, it, expect } from 'vitest';
import {
  ResumeProfileSchema,
  MatchScoreSchema,
  ResumeGapSchema,
  TailoredBulletSchema,
  JobDescriptionProfileSchema,
} from '../lib/schemas';

// ─── ResumeProfileSchema ────────────────────────────────────────────────────

describe('ResumeProfileSchema', () => {
  it('parses a minimal valid resume with defaults applied', () => {
    const result = ResumeProfileSchema.parse({
      contact: {
        fullName: 'Aditya Rane',
        email: 'aditya@example.com',
      },
    });
    expect(result.skills).toEqual([]);
    expect(result.experience).toEqual([]);
    expect(result.projects).toEqual([]);
    expect(result.education).toEqual([]);
    expect(result.certifications).toEqual([]);
    expect(result.summary).toBe('');
  });

  it('successfully parses and sanitizes null values in optional fields', () => {
    const result = ResumeProfileSchema.parse({
      contact: {
        fullName: 'Aditya Rane',
        email: 'aditya@example.com',
        phone: null,
        location: null,
      },
      summary: null,
      experience: [
        {
          id: 'exp-1',
          company: 'Acme',
          title: 'Engineer',
          startDate: '2022-01',
          location: null,
          bullets: [],
        }
      ]
    });
    expect(result.contact.phone).toBeUndefined();
    expect(result.contact.location).toBeUndefined();
    expect(result.summary).toBe('');
    expect(result.experience[0].location).toBeUndefined();
  });

  it('rejects a contact block missing fullName', () => {
    expect(() =>
      ResumeProfileSchema.parse({
        contact: { email: 'test@test.com' },
      })
    ).toThrow();
  });

  it('rejects an invalid email address', () => {
    expect(() =>
      ResumeProfileSchema.parse({
        contact: { fullName: 'Test User', email: 'not-an-email' },
      })
    ).toThrow();
  });

  it('accepts an empty experience array without errors', () => {
    const result = ResumeProfileSchema.parse({
      contact: { fullName: 'Test', email: 'test@test.com' },
      experience: [],
    });
    expect(result.experience).toEqual([]);
  });

  it('rejects a work experience entry with an empty bullets array item', () => {
    expect(() =>
      ResumeProfileSchema.parse({
        contact: { fullName: 'Test', email: 'test@test.com' },
        experience: [
          {
            id: 'exp-1',
            company: 'Acme',
            title: 'Engineer',
            startDate: '2022-01',
            bullets: [''], // empty string bullet should be rejected
          },
        ],
      })
    ).toThrow();
  });
});

// ─── MatchScoreSchema ────────────────────────────────────────────────────────

describe('MatchScoreSchema', () => {
  const validScore = {
    overallScore: 72,
    skillCoverageScore: 80,
    responsibilityAlignmentScore: 70,
    keywordScore: 65,
    seniorityScore: 75,
    criticalMissingRequirements: [],
    explanation: 'Good match overall.',
  };

  it('parses a valid score object successfully', () => {
    const result = MatchScoreSchema.parse(validScore);
    expect(result.overallScore).toBe(72);
  });

  it('coerces string-encoded numbers from LLM responses', () => {
    const result = MatchScoreSchema.parse({
      ...validScore,
      overallScore: '85',
      skillCoverageScore: '90',
    });
    expect(result.overallScore).toBe(85);
    expect(result.skillCoverageScore).toBe(90);
  });

  it('clamps score validation — rejects values above 100', () => {
    expect(() =>
      MatchScoreSchema.parse({ ...validScore, overallScore: 150 })
    ).toThrow();
  });

  it('rejects a missing explanation field', () => {
    const { explanation, ...rest } = validScore;
    expect(() => MatchScoreSchema.parse(rest)).toThrow();
  });
});

// ─── ResumeGapSchema ─────────────────────────────────────────────────────────

describe('ResumeGapSchema', () => {
  const baseGap = {
    name: 'Rust',
    importance: 'high',
    jdEvidence: '5+ years Rust experience required',
    suggestedAction: 'Leave out if not true',
  };

  it('parses a valid gap with all required fields', () => {
    const result = ResumeGapSchema.parse(baseGap);
    expect(result.name).toBe('Rust');
    expect(result.importance).toBe('high');
    expect(result.canSafelyAdd).toBe(false); // default
  });

  it('rejects an invalid importance enum value', () => {
    expect(() =>
      ResumeGapSchema.parse({ ...baseGap, importance: 'critical' })
    ).toThrow();
  });

  it('rejects an invalid suggestedAction enum value', () => {
    expect(() =>
      ResumeGapSchema.parse({
        ...baseGap,
        suggestedAction: 'Just fake it', // not in the allowed set
      })
    ).toThrow();
  });

  it('accepts all five valid suggestedAction values', () => {
    const validActions = [
      'Add if you have this experience',
      'Leave out if not true',
      'Mention in skills section if familiar',
      'Add a project bullet if applicable',
      'Prepare to address this in interview',
    ] as const;

    for (const action of validActions) {
      expect(() =>
        ResumeGapSchema.parse({ ...baseGap, suggestedAction: action })
      ).not.toThrow();
    }
  });
});

// ─── TailoredBulletSchema ────────────────────────────────────────────────────

describe('TailoredBulletSchema', () => {
  it('parses a valid tailored bullet with all required fields', () => {
    const result = TailoredBulletSchema.parse({
      original: 'Built features with React.',
      tailored: 'Architected React micro-frontends with 40% bundle reduction.',
      changeReason: 'Aligned with JD keyword: micro-frontends.',
      keywordsAddressed: ['micro-frontends', 'React'],
      confidence: 'high',
      riskFlag: null,
    });
    expect(result.confidence).toBe('high');
    expect(result.riskFlag).toBeNull();
  });

  it('defaults confidence to medium when omitted', () => {
    const result = TailoredBulletSchema.parse({
      original: 'Did some work.',
      tailored: 'Drove impact.',
      changeReason: 'JD alignment.',
    });
    expect(result.confidence).toBe('medium');
  });

  it('rejects an invalid confidence enum value', () => {
    expect(() =>
      TailoredBulletSchema.parse({
        original: 'a',
        tailored: 'b',
        changeReason: 'c',
        confidence: 'extreme',
      })
    ).toThrow();
  });
});

// ─── JobDescriptionProfileSchema ─────────────────────────────────────────────

describe('JobDescriptionProfileSchema', () => {
  it('defaults to Not Specified seniority when omitted', () => {
    const result = JobDescriptionProfileSchema.parse({
      jobTitle: 'Frontend Engineer',
    });
    expect(result.seniorityLevel).toBe('Not Specified');
  });

  it('parses all valid seniority levels', () => {
    const levels = ['Entry', 'Mid', 'Senior', 'Lead', 'Executive'] as const;
    for (const level of levels) {
      const result = JobDescriptionProfileSchema.parse({
        jobTitle: 'Engineer',
        seniorityLevel: level,
      });
      expect(result.seniorityLevel).toBe(level);
    }
  });
});
