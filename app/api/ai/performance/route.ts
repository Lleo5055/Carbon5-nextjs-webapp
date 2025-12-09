import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * PERFORMANCE AI ENDPOINT
 * AI IS ALLOWED TO DECIDE:
 *  - status
 *  - insight
 *
 * AI IS *NOT* ALLOWED TO DECIDE:
 *  - risk
 *  - stability
 *  - compliance
 *  - score
 */
export async function GET(req: NextRequest) {
  try {
    // Load last 6 months of emissions
    const { data, error } = await supabase
      .from('emissions')
      .select('*')
      .order('month', { ascending: true })
      .limit(6);

    if (error) {
      console.error('DB error:', error);
      return NextResponse.json({ error: 'DB load failed' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'No emissions available' },
        { status: 400 }
      );
    }

    const prompt = `
You are CarbonCentral AI.

Using ONLY the last 6 months of emissions data:
${JSON.stringify(data, null, 2)}

You MUST return **only** this JSON format:

{
  "status": "Falling" | "Rising" | "Stable",
  "insight": string
}

RULES:
- DO NOT return: score, risk, stability, compliance.
- DO NOT add extra fields.
- status is required.
- insight must be 1–2 sentences.
`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert sustainability analyst.',
        },
        { role: 'user', content: prompt },
      ],
    });

    let text = completion.choices[0].message?.content || '{}';

    // Clean wrapper text if needed
    text = text.trim();
    if (!text.startsWith('{')) text = text.slice(text.indexOf('{'));
    if (!text.endsWith('}')) text = text.slice(0, text.lastIndexOf('}') + 1);

    const parsed = JSON.parse(text);

    // 🚫 BLOCK AI FROM INFLUENCING THESE
    const clean = {
      status: parsed.status || 'Stable', // AI allowed
      insight: parsed.insight || 'No insight available.', // AI allowed
      risk: null, // ignored — replaced by dashboard logic
      stability: null, // ignored — replaced by dashboard
      compliance: null, // ignored — replaced by dashboard
    };

    return NextResponse.json(clean);
  } catch (e) {
    console.error('AI performance error:', e);
    return NextResponse.json(
      { error: 'AI performance failed' },
      { status: 500 }
    );
  }
}
