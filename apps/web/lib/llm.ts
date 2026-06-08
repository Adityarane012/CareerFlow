import Groq from 'groq-sdk';
import { z } from 'zod';
import { 
  BULLET_REWRITER_PROMPT, 
  JD_EXTRACTOR_PROMPT, 
  RESUME_PARSER_PROMPT, 
  MATCH_SCORING_PROMPT, 
  GAP_ANALYZER_PROMPT 
} from './prompt-templates';
import { 
  TailoredResumeSchema, 
  JobDescriptionProfile, 
  JobDescriptionProfileSchema, 
  ResumeProfile, 
  ResumeProfileSchema, 
  MatchScore, 
  MatchScoreSchema, 
  ResumeGap, 
  ResumeGapSchema 
} from './schemas';

// Validate required environment variables at module load time
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  throw new Error(
    '[Resume Shapeshifter] GROQ_API_KEY is not set.\n' +
    'Add it to your .env.local file:\n  GROQ_API_KEY=your_key_here\n' +
    'Get a free key at https://console.groq.com/keys'
  );
}

// Initializing the Groq SDK client using process-level variables
const groq = new Groq({ 
  apiKey: GROQ_API_KEY 
});

/**
 * Sends parsing operations to the LLM to rewrite experience bullets.
 * Includes exponential retry fallback structures to protect against transient errors.
 */
export async function executeBulletSurgery(
  originalExperience: string,
  targetJDKeywords: string[],
  retries = 3,
  delay = 1000
): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: BULLET_REWRITER_PROMPT },
          { 
            role: 'user', 
            content: JSON.stringify({
              experience: originalExperience,
              targetKeywords: targetJDKeywords
            }) 
          }
        ],
        response_format: { type: 'json_object' },
      });

      const parsedContent = completion.choices[0].message.content;
      if (!parsedContent) {
        throw new Error('LLM returned an empty content body.');
      }
      
      const parsedData = JSON.parse(parsedContent);
      return TailoredResumeSchema.parse(parsedData);
    } catch (error) {
      if (attempt === retries) throw error;
      console.warn(`LLM request failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
      delay *= 2; // Exponential backoff scaling
    }
  }
}

/**
 * Parses raw Job Description text into structured JSON schema profile.
 */
export async function extractJobDescription(
  rawJD: string,
  retries = 3,
  delay = 1000
): Promise<JobDescriptionProfile> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: JD_EXTRACTOR_PROMPT },
          { role: 'user', content: rawJD }
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0].message.content;
      if (!content) throw new Error('Empty response from Groq JD Extractor.');
      
      return JobDescriptionProfileSchema.parse(JSON.parse(content));
    } catch (error) {
      if (attempt === retries) throw error;
      console.warn(`JD extraction failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
  throw new Error('Unreachable code block reached.');
}

/**
 * Standardizes chaotic, raw resume text into structured ResumeProfile schema.
 */
export async function parseResumeText(
  rawText: string,
  retries = 3,
  delay = 1000
): Promise<ResumeProfile> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: RESUME_PARSER_PROMPT },
          { role: 'user', content: rawText }
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0].message.content;
      if (!content) throw new Error('Empty response from Groq Resume Parser.');
      
      return ResumeProfileSchema.parse(JSON.parse(content));
    } catch (error) {
      if (attempt === retries) throw error;
      console.warn(`Resume parsing failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
  throw new Error('Unreachable code block reached.');
}

/**
 * Computes match scoring metrics across multiple alignment categories.
 */
export async function calculateMatchScore(
  resume: ResumeProfile,
  jd: JobDescriptionProfile,
  retries = 3,
  delay = 1000
): Promise<MatchScore> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: MATCH_SCORING_PROMPT },
          { 
            role: 'user', 
            content: JSON.stringify({ resume, jobDescription: jd }) 
          }
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0].message.content;
      if (!content) throw new Error('Empty response from Groq Match Scoring.');
      
      return MatchScoreSchema.parse(JSON.parse(content));
    } catch (error) {
      if (attempt === retries) throw error;
      console.warn(`Match scoring failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
  throw new Error('Unreachable code block reached.');
}

/**
 * Identifies technologies and experience gaps between resume and JD.
 */
export async function analyzeResumeGaps(
  resume: ResumeProfile,
  jd: JobDescriptionProfile,
  retries = 3,
  delay = 1000
): Promise<ResumeGap[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: GAP_ANALYZER_PROMPT },
          { 
            role: 'user', 
            content: JSON.stringify({ resume, jobDescription: jd }) 
          }
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0].message.content;
      if (!content) throw new Error('Empty response from Groq Gap Analyzer.');
      
      const parsedData = JSON.parse(content);
      // If the model returned an object with a "gaps" property, extract it, otherwise parse directly as array
      const rawGaps = Array.isArray(parsedData) ? parsedData : parsedData.gaps || [];
      
      return z.array(ResumeGapSchema).parse(rawGaps);
    } catch (error) {
      if (attempt === retries) throw error;
      console.warn(`Gap analysis failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
  throw new Error('Unreachable code block reached.');
}


