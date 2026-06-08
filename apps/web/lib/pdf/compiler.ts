import { Browser } from 'puppeteer-core';

/**
 * Dynamically launches Puppeteer.
 * Uses @sparticuz/chromium in production, and standard local puppeteer in development.
 */
export async function getBrowser(): Promise<any> {
  const isProd = process.env.NODE_ENV === 'production';
  
  if (isProd) {
    try {
      const puppeteerCore = await import('puppeteer-core');
      const chromium = (await import('@sparticuz/chromium')).default as any;
      
      return puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless === 'true' || chromium.headless === true || true,
      });
    } catch (err) {
      console.warn('Failed to load @sparticuz/chromium, falling back to standard puppeteer:', err);
    }
  }

  // Local development fallback
  const puppeteer = await import('puppeteer');
  const options: any = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };
  
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  return puppeteer.launch(options);
}

/**
 * Compiles an HTML template string into an A4 print-ready PDF binary buffer.
 */
export async function compileHTMLToPDF(htmlContent: string): Promise<Buffer> {
  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    
    // Set standard A4 viewport dimensions
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Render to portrait PDF
    const pdfUint8Array = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px'
      }
    });
    
    return Buffer.from(pdfUint8Array);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
