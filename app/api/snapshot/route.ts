// app/api/snapshot/route.ts
import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { supabase } from '@/lib/supabaseClient';

// IMPORTANT — USE YOUR EXISTING SERVER HTML BUILDER
import LeadershipSnapshotServer from '@/app/components/LeadershipSnapshotServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. AUTH
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. LOAD DATA (same supabaseClient you already use)
    const { data: emissions } = await supabase
      .from('emissions')
      .select('*')
      .order('month', { ascending: true });

    const { data: scope3 } = await supabase
      .from('scope3_activities')
      .select('*')
      .order('month', { ascending: true });

    // 3. GENERATE HTML STRING USING YOUR SERVER COMPONENT
    const html = LeadershipSnapshotServer({
      emissions: emissions ?? [],
      scope3: scope3 ?? [],
    });

    // 4. LAUNCH BROWSER (VERCEL-SAFE)
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // load HTML into Puppeteer
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // 5. GENERATE PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px' },
    });

    await browser.close();

    // 6. RETURN PDF RESPONSE
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
