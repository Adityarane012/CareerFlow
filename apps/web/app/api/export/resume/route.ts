import { NextRequest, NextResponse } from 'next/server';
import { generateCleanResumeHTML } from '../../../../lib/pdf-html-templates';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const runData = await request.json();

    if (!runData || !runData.targetJobDescription || !runData.tailoredResume) {
      return NextResponse.json(
        { error: 'Valid TailoringRun data manifest is required in request payload.' },
        { status: 400 }
      );
    }

    // Generate clean recruiter-ready HTML for client-side print-to-PDF
    const html = generateCleanResumeHTML(runData);

    return NextResponse.json({ html });
  } catch (error) {
    console.error('Clean PDF export service endpoint failure:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal failure during clean PDF generation.' },
      { status: 500 }
    );
  }
}
