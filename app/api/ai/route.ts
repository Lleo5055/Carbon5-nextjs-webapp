// app/api/ai/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET(req: NextRequest) {
  try {
    // 1. Load last 12 months emissions
    const { data, error } = await supabase
      .from('emissions')
      .select('*')
      .order('month', { ascending: true })
      .limit(12);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch emissions' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        {
          summary: 'Benchmarking unavailable – no emissions data found.',
          industry_average_tonnes: 2.0,
          you_tonnes: 0,
        },
        { status: 200 }
      );
    }

    // 2. Compute user's total emissions (you_tonnes)
    const total = data.reduce((sum, row) => sum + (row.total_co2e_kg || 0), 0);
    const youTonnes = total / 1000; // convert kg → tonnes

    // Prepare compact dataset for AI
    const clean = data.map((row) => ({
      month: row.month,
      total_co2e_kg: row.total_co2e_kg || 0,
    }));

    // 3. STRICT BENCHMARKING PROMPT
    const prompt = `
You are Carbon Central AI.

Your ONLY job is to benchmark a business against a typical SME in its sector.
Do NOT analyse trends, do NOT describe months, do NOT give recommendations.

Here is the user's dataset:
${JSON.stringify(clean, null, 2)}

User's total emissions (tonnes): ${youTonnes.toFixed(2)}

Return JSON ONLY in this exact shape:

{
  "summary": string,
  "industry_average_tonnes": number,
  "you_tonnes": number
}

RULES:
- summary MUST be ONE short sentence comparing the user to the industry average.
- industry_average_tonnes MUST be a SINGLE number (e.g., 1.82), no units.
- you_tonnes MUST equal the value provided (${youTonnes.toFixed(2)}).
- DO NOT return narratives, explanations, dataset analysis, or recommendations.
- DO NOT talk about “highest month”, “fuel”, “electricity”, or “refrigerant”.
- Keep it strictly benchmarking only.
`;

    // 4. Call OpenAI
    const completion = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: prompt,
    });

    let raw = completion.output_text || '{}';

    // Clean stray text
    try {
      raw = raw.trim();
      if (!raw.startsWith('{')) raw = raw.slice(raw.indexOf('{'));
      if (!raw.endsWith('}')) raw = raw.slice(0, raw.lastIndexOf('}') + 1);
    } catch {}

    let json;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      console.error('AI JSON parse failed → raw output:', raw);
      json = {
        summary: 'Benchmarking unavailable due to AI error.',
        industry_average_tonnes: 2.0,
        you_tonnes: youTonnes,
      };
    }

    // Always enforce your_tonnes to be correct
    json.you_tonnes = youTonnes;

    return NextResponse.json(json, { status: 200 });
  } catch (err) {
    console.error('AI Benchmarking Error:', err);
    return NextResponse.json(
      {
        summary: 'Benchmarking unavailable due to system error.',
        industry_average_tonnes: 2.0,
        you_tonnes: 0,
      },
      { status: 500 }
    );
  }
}
