// lib/aiInsightsCore.ts
import { supabase } from './supabaseClients';
import OpenAI from 'openai';

// IMPORTANT: Use your real key in .env or hardcoded fallback
const openaiApiKey =
  process.env.OPENAI_API_KEY ||
  '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';

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// This matches YOUR REAL DATABASE COLUMNS
type CompactMonth = {
  month: string;
  electricity_kwh: number;
  fuel_litres: number;
  refrigerant_kg: number;
  total_co2e_kg: number;
};

type AIAction = {
  id: string;
  title: string;
  detail: string;
};

type AIInsight = {
  headline: string;
  narrative: string;
  hotspot: 'Electricity' | 'Fuel' | 'Refrigerant' | null;
  confidence: 'low' | 'medium' | 'high';
  actions: AIAction[];
};

/**
 * Generate and store AI insight for a single user.
 * Reads emissions → calls OpenAI → saves into ai_insights table
 */
export async function generateAIInsightForUser(
  userId: string,
  period: string = 'last_12_months',
  monthsLimit: number = 12
) {
  // 1. Load emissions for this user
  const { data, error } = await supabase
    .from('emissions')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: true })
    .limit(monthsLimit);

  if (error) throw new Error(`Failed to load emissions: ${error.message}`);

  // 🔥🔥 THE FIX — map your REAL DB fields correctly
  const compact: CompactMonth[] =
    data?.map((row: any) => {
      const diesel = Number(row.diesel_litres ?? 0);
      const petrol = Number(row.petrol_litres ?? 0);
      const legacyFuel = Number(row.fuel_liters ?? 0); // fallback

      const fuel_litres = diesel + petrol > 0 ? diesel + petrol : legacyFuel; // support old + new schema

      return {
        month: row.month,
        electricity_kwh: Number(row.electricity_kw ?? 0),
        fuel_litres,
        refrigerant_kg: Number(row.refrigerant_kg ?? 0),
        total_co2e_kg: Number(row.total_co2e ?? 0),
      };
    }) ?? [];

  // 2. Build prompt
  const systemPrompt = `
You are Carbon Central AI, an expert sustainability analyst for small businesses.

You receive monthly emissions data and must produce:
1) A concise headline (1 sentence)
2) A 3–4 sentence narrative explaining trends
3) A named hotspot (Electricity, Fuel, Refrigerant) or null if unclear
4) A confidence rating (low, medium, high)
5) A list of 3–5 very specific, actionable steps the business can take

Respond ONLY as strict JSON matching this TypeScript contract:

{
  "headline": string,
  "narrative": string,
  "hotspot": "Electricity" | "Fuel" | "Refrigerant" | null,
  "confidence": "low" | "medium" | "high",
  "actions": [
    { "id": string, "title": string, "detail": string }
  ]
}
`.trim();

  const userPrompt = `
Here is the business's monthly emissions data:
${JSON.stringify(compact, null, 2)}

Think step-by-step and output ONLY valid JSON.
`;

  // 3. Call OpenAI
  const completion = await openai.responses.create({
    model: 'gpt-4.1-mini',
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const rawText = completion.output_text;
  if (!rawText) throw new Error('AI returned empty response');

  let aiInsight: AIInsight;
  try {
    aiInsight = JSON.parse(rawText);
  } catch (err: any) {
    console.error('Raw AI output:', rawText);
    throw new Error('Failed to parse AI JSON: ' + err.message);
  }

  // 4. Save to Supabase
  const { error: upsertError } = await supabase.from('ai_insights').upsert(
    {
      user_id: userId,
      period,
      headline: aiInsight.headline,
      narrative: aiInsight.narrative,
      hotspot: aiInsight.hotspot,
      confidence: aiInsight.confidence,
      actions: aiInsight.actions,
      raw: aiInsight,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,period' }
  );

  if (upsertError)
    throw new Error('Failed to upsert ai_insights: ' + upsertError.message);

  return aiInsight;
}

/**
 * Batch mode — recompute insights for ALL users
 */
export async function generateAIInsightsForAllUsers(
  period: string = 'last_12_months',
  monthsLimit: number = 12
) {
  const { data, error } = await supabase
    .from('emissions')
    .select('user_id')
    .neq('user_id', null);

  if (error) throw new Error('Failed loading users: ' + error.message);

  const userIds = [...new Set(data.map((x: any) => x.user_id))];

  const results: any[] = [];

  for (const uid of userIds) {
    try {
      const insight = await generateAIInsightForUser(uid, period, monthsLimit);
      results.push({ user: uid, ok: true, insight });
    } catch (err: any) {
      results.push({ user: uid, ok: false, error: err.message });
    }
  }

  return { processed: results.length, results };
}
