import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { loadUKFactors } from '@/lib/factors';
import { calculateCo2e } from '@/lib/calcCo2e';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      month,
      electricityKwh,
      dieselLitres,
      petrolLitres,
      gasKwh,
      refrigerantType,
      refrigerantKg,
      user_id, // ⬅ IMPORTANT: make sure frontend sends this
    } = body;

    // 1. Load DEFRA 2024 UK factors
    const factors = await loadUKFactors();

    // 2. Calculate CO₂e using unified engine
    const result = calculateCo2e(
      {
        electricityKwh,
        dieselLitres,
        petrolLitres,
        gasKwh,
        refrigerantType,
        refrigerantKg,
      },
      factors
    );

    // 3. Insert into Supabase
    const { error } = await supabase.from('emissions').insert({
      month,
      electricity_kwh: electricityKwh || 0,
      diesel_litres: dieselLitres || 0,
      petrol_litres: petrolLitres || 0,
      gas_kwh: gasKwh || 0,
      refrigerant_type: refrigerantType || null,
      refrigerant_kg: refrigerantKg || 0,
      total_co2e: result.total,
      factor_version: factors.version,
      user_id, // ⬅ Required for AI refresh tracking
    });

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ✅ 4. AI AUTO-REFRESH (background, non-blocking)
    if (user_id) {
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id }),
      }).catch(() => {});
    }

    // 5. Return success
    return NextResponse.json({
      message: 'Emission entry added successfully',
      totalCo2e: result.total,
      breakdown: result,
      factorVersion: factors.version,
    });
  } catch (err: any) {
    console.error('API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
