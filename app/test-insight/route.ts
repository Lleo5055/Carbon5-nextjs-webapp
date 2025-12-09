// app/api/ai/test-insight/route.ts
import { NextResponse } from 'next/server';
import { generateAIInsightForUser } from '@/lib/aiInsightsCore';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const result = await generateAIInsightForUser(userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
