import { NextRequest, NextResponse } from 'next/server';
import { compileHTMLToPDF } from '../../../../../lib/pdf/compiler';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { html, appId } = await request.json();

    if (!html || !appId) {
      return NextResponse.json(
        { error: 'HTML template content and application ID (appId) are required.' },
        { status: 400 }
      );
    }

    // Compile A4 PDF buffer
    const pdfBuffer = await compileHTMLToPDF(html);

    // Save to local public static directory
    const publicDir = path.join(process.cwd(), 'public');
    const resumesDir = path.join(publicDir, 'resumes');
    
    if (!fs.existsSync(resumesDir)) {
      fs.mkdirSync(resumesDir, { recursive: true });
    }

    const fileName = `${appId}.pdf`;
    const filePath = path.join(resumesDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    // Return static URL
    const pdfUrl = `/resumes/${fileName}`;

    return NextResponse.json({
      status: 'success',
      pdfUrl,
    });
  } catch (error) {
    console.error('PDF server-side compile endpoint failure:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal failure during server-side PDF compilation.' },
      { status: 500 }
    );
  }
}
