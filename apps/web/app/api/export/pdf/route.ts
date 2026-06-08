import { NextRequest, NextResponse } from 'next/server';
import { generateSideBySideHTML } from '../../../../lib/pdf-html-templates';

export async function POST(request: NextRequest) {
  try {
    const runData = await request.json();

    if (!runData || !runData.targetJobDescription || !runData.tailoredResume) {
      return NextResponse.json(
        { error: 'Valid TailoringRun data manifest is required in request payload.' },
        { status: 400 }
      );
    }

    // Generate styled HTML for client-side print-to-PDF
    const html = generateSideBySideHTML(runData);

    return NextResponse.json({ html });
  } catch (error) {
    console.error('PDF export service endpoint failure:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal failure during PDF generation.' },
      { status: 500 }
    );
  }
}
