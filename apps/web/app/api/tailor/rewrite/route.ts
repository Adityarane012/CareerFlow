import { NextRequest, NextResponse } from 'next/server';
import { executeBulletSurgery, calculateMatchScore } from '../../../../lib/llm';
import { ResumeProfile } from '../../../../lib/schemas';

export async function POST(request: NextRequest) {
  try {
    const { 
      originalResume, 
      targetJobDescription, 
      originalScore, 
      identifiedGaps 
    } = await request.json();

    if (!originalResume || !targetJobDescription) {
      return NextResponse.json(
        { error: 'Structured originalResume and targetJobDescription are required in payload.' },
        { status: 400 }
      );
    }

    // 1. Run the surgical bullet rewriter in one single call via Groq
    const originalExperienceStr = JSON.stringify(originalResume.experience);
    const tailoredResume = await executeBulletSurgery(
      originalExperienceStr, 
      targetJobDescription.keywords || []
    );

    // Fail-safe: Combine original skills and LLM tailored skills so skill coverage never degrades
    const combinedSkills = Array.from(new Set([
      ...(tailoredResume.tailoredSkills || []),
      ...(originalResume.skills || [])
    ])).filter(Boolean);

    // 2. Map the tailored resume back to a full ResumeProfile structure to compute post-tailoring score
    const tailoredProfile: ResumeProfile = {
      contact: originalResume.contact,
      summary: tailoredResume.tailoredSummary || originalResume.summary || "",
      skills: combinedSkills,
      // Fail-safe: Map over originalResume.experience to guarantee NO work experience entries
      // or bullets are ever lost or truncated by the LLM.
      experience: originalResume.experience.map((origJob: any, idx: number) => {
        const tailoredJob = tailoredResume.tailoredExperience?.[idx] || 
                            tailoredResume.tailoredExperience?.find((j: any) => j.company?.toLowerCase() === origJob.company?.toLowerCase());
        
        if (!tailoredJob) {
          // If the LLM omitted this entire job, preserve it completely
          return origJob;
        }

        return {
          id: origJob.id,
          company: tailoredJob.company || origJob.company,
          title: tailoredJob.title || origJob.title,
          location: origJob.location,
          startDate: origJob.startDate,
          endDate: origJob.endDate,
          // Preserve all bullets, substituting tailored ones where available
          bullets: origJob.bullets.map((origBullet: string, bIdx: number) => {
            const tailoredBulletObj = tailoredJob.bullets?.[bIdx];
            return tailoredBulletObj && typeof tailoredBulletObj.tailored === 'string' && tailoredBulletObj.tailored.trim() !== ''
              ? tailoredBulletObj.tailored
              : origBullet;
          })
        };
      }),
      projects: originalResume.projects || [],
      education: originalResume.education || [],
      certifications: originalResume.certifications || []
    };

    // 3. Compute post-tailoring matching scores
    const tailoredScore = await calculateMatchScore(tailoredProfile, targetJobDescription);

    // Reconstruct a fully safe and merged tailoredResume structure for the frontend comparison grid
    const mergedTailoredResume = {
      tailoredSummary: tailoredResume.tailoredSummary || originalResume.summary || "",
      tailoredSkills: combinedSkills,
      tailoredExperience: originalResume.experience.map((origJob: any, idx: number) => {
        const tailoredJob = tailoredResume.tailoredExperience?.[idx] || 
                            tailoredResume.tailoredExperience?.find((j: any) => j.company?.toLowerCase() === origJob.company?.toLowerCase());

        return {
          company: origJob.company,
          title: origJob.title,
          bullets: origJob.bullets.map((origBullet: string, bIdx: number) => {
            const tailoredBullet = tailoredJob?.bullets?.[bIdx];
            if (tailoredBullet && typeof tailoredBullet.tailored === 'string' && tailoredBullet.tailored.trim() !== '') {
              return {
                original: origBullet,
                tailored: tailoredBullet.tailored,
                changeReason: tailoredBullet.changeReason || "Tailored experience to match target job context.",
                keywordsAddressed: tailoredBullet.keywordsAddressed || [],
                confidence: tailoredBullet.confidence || "high",
                riskFlag: tailoredBullet.riskFlag || null
              };
            }
            // Fallback: If not tailored by the LLM, return the original bullet untouched
            return {
              original: origBullet,
              tailored: origBullet,
              changeReason: "Preserved original experience to maintain complete truthfulness and document integrity.",
              keywordsAddressed: [],
              confidence: "high",
              riskFlag: null
            };
          })
        };
      })
    };

    // 4. Assemble the complete session manifest (TailoringRun)
    const runId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return NextResponse.json({
      runId,
      createdAt: new Date().toISOString(),
      originalResume,
      targetJobDescription,
      originalScore: originalScore || { overallScore: 0, skillCoverageScore: 0, responsibilityAlignmentScore: 0, keywordScore: 0, seniorityScore: 0, criticalMissingRequirements: [], explanation: '' },
      tailoredScore,
      tailoredResume: mergedTailoredResume,
      identifiedGaps: identifiedGaps || []
    });
  } catch (error) {
    console.error('Tailor rewrite endpoint failure:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal failure during resume surgical tailoring.' },
      { status: 500 }
    );
  }
}
