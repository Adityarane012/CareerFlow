import mammoth from 'mammoth';

/**
 * Parses a PDF buffer and strips consecutive whitespaces.
 * Enforces security checks on password layers and checks minimum lengths.
 *
 * NOTE: pdf-parse is loaded via require() at runtime (not a static import) to prevent
 * Turbopack/webpack from bundling it — the bundler corrupts its internal dynamic require()
 * calls, breaking the pdfjs-dist function references at runtime ("t is not a function").
 * next.config.ts also lists pdf-parse in serverExternalPackages for the same reason.
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    const cleanedText = data.text.replace(/\r\n/g, '\n').replace(/ +/g, ' ').trim();

    if (cleanedText.length < 50) {
      throw new Error('No readable text content. The document might be scanned or empty.');
    }
    return cleanedText;
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('encrypted')) {
      throw new Error('This PDF is password-protected or encrypted. Please remove protection and try again.');
    }
    throw new Error(`Failed to parse PDF binary file stream: ${msg}`);
  }
}

/**
 * Extracts raw textual contents from DOCX files.
 */
export async function parseDocxBuffer(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const cleanedText = result.value.replace(/\r\n/g, '\n').trim();
    
    if (cleanedText.length < 50) {
      throw new Error("Extracted DOCX text is too short. Please verify the document content.");
    }
    return cleanedText;
  } catch (error) {
    throw new Error(`Failed to parse Word Document binary file stream: ${(error as Error).message}`);
  }
}
