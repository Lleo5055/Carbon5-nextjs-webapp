// app/api/snapshot/route.ts
import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { supabase } from '@/lib/supabaseClient';
import LeadershipSnapshotServer from '@/app/components/LeadershipSnapshotServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // AUTH (client session)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // LOAD DATA
    const { data: emissions } = await supabase
      .from('emissions')
      .select('*')
      .order('month', { ascending: true });

    const { data: scope3 } = await supabase
      .from('scope3_activities')
      .select('*')
      .order('month', { ascending: true });

    // BUILD HTML
    const html = LeadershipSnapshotServer({
      emissions: emissions ?? [],
      scope3: scope3 ?? [],
    });

    // LAUNCH BROWSER (VERCEL SAFE)
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // PDF
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
