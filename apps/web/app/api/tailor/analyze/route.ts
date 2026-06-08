import { NextRequest, NextResponse } from 'next/server';
import { 
  parseResumeText, 
  extractJobDescription, 
  calculateMatchScore, 
  analyzeResumeGaps 
} from '../../../../lib/llm';

export async function POST(request: NextRequest) {
  try {
    const { resumeText, jobDescription } = await request.json();

    if (!resumeText || !resumeText.trim()) {
      return NextResponse.json(
        { error: 'Resume context is required.' },
        { status: 400 }
      );
    }

    if (!jobDescription || !jobDescription.trim()) {
      return NextResponse.json(
        { error: 'Job description text is required.' },
        { status: 400 }
      );
    }

    // 1. Structure the raw resume text via Groq
    const originalResume = await parseResumeText(resumeText);

    // 2. Extract semantic JD structure via Groq
    const targetJobDescription = await extractJobDescription(jobDescription);

    // 3. Compute original (pre-tailor) matching scores
    const originalScore = await calculateMatchScore(originalResume, targetJobDescription);

    // 4. Run gap analysis
    const identifiedGaps = await analyzeResumeGaps(originalResume, targetJobDescription);

    return NextResponse.json({
      originalResume,
      targetJobDescription,
      originalScore,
      identifiedGaps
    });
  } catch (error) {
    console.error('Tailor analysis endpoint failure:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal failure during resume analysis.' },
      { status: 500 }
    );
  }
}
