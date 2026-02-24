import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  // 1) Safety: API key present?
  // Suggestion: `client` should be created below this check, to take advantage of it (also in general, it's best to do it per request, so inside the request handler).
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not configured');
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not configured on the server.' },
      { status: 500 }
    );
  }

  // 2) Parse incoming JSON (your dashboard summary)
  let summary: unknown;
  try {
    summary = await req.json();
  } catch (err) {
    console.error('Bad JSON body for /api/ai-insights', err);
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a carbon-reporting co-pilot. You look at a small JSON summary of an SME carbon dashboard and return: (1) one short headline, and (2) 3–4 short, practical, ROI-focused insights as bullet points. You do NOT repeat the raw numbers; you interpret them.',
        },
        {
          role: 'user',
          content: `Here is the JSON summary of the dashboard. Respond ONLY as JSON with keys "headline" (string) and "insights" (array of strings, length 3–4).\n\n${JSON.stringify(
            summary,
            null,
            2
          )}`,
        },
      ],
      max_tokens: 400,
    });

    const content = completion.choices[0]?.message?.content || '{}';

    let parsed: { headline?: string; insights?: string[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error('Failed to parse AI JSON', err, 'raw:', content);
      parsed = { headline: 'AI insights unavailable', insights: [] };
    }

    return NextResponse.json({
      headline: parsed.headline ?? 'AI insights',
      insights: parsed.insights ?? [],
    });
  } catch (err) {
    console.error('AI insights error', err);
    return NextResponse.json(
      { error: 'Failed to generate AI insights.' },
      { status: 500 }
    );
  }
}

// Optional: simple GET for quick testing in browser
export async function GET() {
  return NextResponse.json({
    headline: 'AI endpoint is live',
    insights: [
      'POST a JSON dashboard summary to /api/ai-insights to get real insights.',
    ],
  });
}
