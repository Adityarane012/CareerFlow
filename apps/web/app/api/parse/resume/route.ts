import { NextRequest, NextResponse } from 'next/server';
import { parsePdfBuffer, parseDocxBuffer } from '../../../../lib/parser';

// Explicitly use the Node.js runtime — pdf-parse and mammoth require native Node APIs
// that are not available in the Edge runtime.
export const runtime = 'nodejs';

/**
 * Handles incoming multipart/form-data file uploads and parses PDF/DOCX binaries.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file was uploaded in the request payload.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();
    let extractedText = '';

    if (fileName.endsWith('.pdf')) {
      extractedText = await parsePdfBuffer(buffer);
    } else if (fileName.endsWith('.docx')) {
      extractedText = await parseDocxBuffer(buffer);
    } else if (fileName.endsWith('.txt')) {
      extractedText = buffer.toString('utf-8');
    } else {
      return NextResponse.json(
        { error: 'Unsupported file extension. Only .pdf, .docx, and .txt files are supported.' },
        { status: 415 }
      );
    }

    return NextResponse.json({
      text: extractedText,
      fileName: file.name,
      fileSize: file.size
    });
  } catch (error) {
    console.error('File parsing service endpoint failure:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'An internal error occurred during file extraction.' },
      { status: 500 }
    );
  }
}
