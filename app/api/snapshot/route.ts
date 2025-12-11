import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';
import LeadershipSnapshotServer from '@/app/components/LeadershipSnapshotServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Same as REPORT ROUTE:
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // --- NO AUTH CHECK HERE ---

    // --- LOAD DATA ---
    const { data: emissions } = await supabase
      .from('emissions')
      .select('*')
      .order('month', { ascending: true });

    const { data: scope3 } = await supabase
      .from('scope3_activities')
      .select('*')
      .order('month', { ascending: true });

    const html = LeadershipSnapshotServer({
      emissions: emissions ?? [],
      scope3: scope3 ?? [],
    });

    const browser = await puppeteer.launch({
  args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: chromium.defaultViewport,
  executablePath:
    process.env.CHROME_EXECUTABLE_PATH || (await chromium.executablePath()),
  headless: true,
});


    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px' },
    });

    await browser.close();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="leadership-snapshot.pdf"',
      },
    });
  } catch (err) {
    console.error('SNAPSHOT ERROR:', err);
    return NextResponse.json(
      { error: 'Failed to generate snapshot' },
      { status: 500 }
    );
  }
}
