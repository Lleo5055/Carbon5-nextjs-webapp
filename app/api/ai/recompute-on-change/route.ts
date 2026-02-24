import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Suggestion: Can be moved to a file in lib/ or utils/ for reusability
function safeNumber(v: any) {
  return typeof v === 'number' && !isNaN(v) ? v : 0;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, month } = body;

    if (!user_id || !month) {
      return NextResponse.json(
        { error: 'Missing user_id/month' },
        { status: 400 }
      );
    }

    // 1. Fetch emissions
    const { data: current } = await supabase
      .from('emissions')
      .select('*')
      .eq('user_id', user_id)
      .eq('month', month)
      .single();

    if (!current) {
      return NextResponse.json({ error: 'No emission found' }, { status: 404 });
    }

    // 2. Fetch last 3 months
    const { data: last3 } = await supabase
      .from('emissions')
      .select('*')
      .eq('user_id', user_id)
      .order('month', { ascending: false })
      .limit(4);

    // 3. Build payload
    const aiInput = {
      current_month: current.month,
      electricity_kw: safeNumber(current.electricity_kw),
      fuel_liters: safeNumber(current.fuel_liters),

      diesel_litres: safeNumber(current.diesel_litres),
      petrol_litres: safeNumber(current.petrol_litres),
      gas_kwh: safeNumber(current.gas_kwh),

      refrigerant_type: current.refrigerant_type,
      refrigerant_code: current.refrigerant_code,
      refrigerant_gwp_used: safeNumber(current.refrigerant_gwp_used),
      refrigerant_kg: safeNumber(current.refrigerant_kg),

      total_co2e: safeNumber(current.total_co2e),
      last_3_months: last3 || [],
    };

    // 4. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a carbon analysis engine for a UK SME. Always return JSON with summary, risk_level, recommendations, anomalies, and regulatory_flags.',
        },
        {
          role: 'user',
          content: JSON.stringify(aiInput),
        },
      ],
    });

    const ai = JSON.parse(completion.choices[0].message.content || '{}');

    // 5. Save insights
    await supabase.from('ai_insights').insert({
      user_id,
      month,
      summary: ai.summary || '',
      risk_level: ai.risk_level || '',
      recommendations: ai.recommendations || [],
      anomalies: ai.anomalies || {},
      regulatory_flags: ai.regulatory_flags || [],
      total_co2e: safeNumber(current.total_co2e),
      factor_version: current.factor_version || 'v1',
      raw_input: aiInput,
      raw_ai_output: ai,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('AUTO AI ERROR:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
