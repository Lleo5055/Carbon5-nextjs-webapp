// app/api/ai/recompute-all/route.ts
import { NextResponse } from 'next/server';
import { generateAIInsightsForAllUsers } from '@/lib/aiInsightsCore';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'super-long-random-string';

export async function POST(req: Request) {
  const auth = req.headers.get('Authorization');

  if (!auth || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await generateAIInsightsForAllUsers();
    return NextResponse.json(
      { message: 'Batch complete', result },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
