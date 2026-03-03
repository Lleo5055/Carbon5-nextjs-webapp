// app/dashboard/emissions/add/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getFactorsForCountry } from '@/lib/factors';
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
      user_id,
    } = body;

    // 1. Look up the user's country from their profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('country')
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.warn('Could not load profile country, falling back to GB:', profileError.message);
    }

    const countryCode = profile?.country ?? 'GB';

    // 2. Load geo-optimised factors for the user's country (synchronous, in-memory)
    const factors = getFactorsForCountry(countryCode);

    // 3. Calculate CO₂e using unified engine
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

    // 4. Insert into Supabase (country_code auto-set by DB trigger, but
    //    we also pass it explicitly here for transparency and auditability)
    const { error } = await supabase.from('emissions').insert({
      month,
      electricity_kwh:  electricityKwh  || 0,
      diesel_litres:    dieselLitres    || 0,
      petrol_litres:    petrolLitres    || 0,
      gas_kwh:          gasKwh          || 0,
      refrigerant_type: refrigerantType || null,
      refrigerant_kg:   refrigerantKg   || 0,
      total_co2e:       result.total,
      factor_version:   factors.version,
      country_code:     countryCode,
      user_id,
    });

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 5. AI auto-refresh (background, non-blocking)
    if (user_id) {
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id }),
      }).catch(() => {});
    }

    // 6. Return success
    return NextResponse.json({
      message:       'Emission entry added successfully',
      totalCo2e:     result.total,
      breakdown:     result,
      factorVersion: factors.version,
      countryCode,
    });

  } catch (err: any) {
    console.error('API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}