// app/api/ai/recommended-actions/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const electricity = Number(body.electricity || 0);
    const fuel = Number(body.fuel || 0);
    const refrigerant = Number(body.refrigerant || 0);
    const months = Number(body.months || 0);

    let prompt = `
You are an environmental carbon reduction advisor.
Given:
- Electricity share: ${electricity}%
- Fuel share: ${fuel}%
- Refrigerant share: ${refrigerant}%
- Months of data: ${months}

Suggest exactly 3 practical next actions.
Return ONLY a JSON array of objects: [{ "title": "", "description": "" }]`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 200,
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');

    return NextResponse.json({
      actions: parsed.actions || [],
    });
  } catch (err) {
    console.error('AI recommended actions error:', err);
    return NextResponse.json({ actions: [] });
  }
}
