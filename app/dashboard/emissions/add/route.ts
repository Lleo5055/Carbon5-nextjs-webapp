import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { getFactorsForCountry } from '@/lib/factors';
import { calculateCo2e } from '@/lib/calcCo2e';
import { checkRefrigerantWatch } from '@/lib/refrigerantWatch';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      month,
      electricityKwh,
      dieselLitres,
      petrolLitres,
      gasKwh,
      lpgKg,
      cngKg,
      refrigerantType,
      refrigerantKg,
      user_id,
    } = body;

    // 1. Look up country from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('country')
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.warn('Could not load profile country, falling back to GB:', profileError.message);
    }

    const countryCode = profile?.country ?? 'GB';
    const factors = getFactorsForCountry(countryCode);

    // 2. Calculate using existing engine
    const result = calculateCo2e(
      {
        electricityKwh:  Number(electricityKwh)  || 0,
        dieselLitres:    Number(dieselLitres)    || 0,
        petrolLitres:    Number(petrolLitres)    || 0,
        gasKwh:          Number(gasKwh)          || 0,
        lpgKg:           Number(lpgKg)           || 0,
        cngKg:           Number(cngKg)           || 0,
        refrigerantType: refrigerantType || 'GENERIC_HFC',
        refrigerantKg:   Number(refrigerantKg)   || 0,
      },
      factors
    );

    // 3. Build calc_breakdown
    const calc_breakdown = {
      electricity: {
        qty: Number(electricityKwh) || 0,
        unit: 'kWh',
        factor: factors.electricity,
        kg_co2e: result.electricity,
      },
      diesel: {
        qty: Number(dieselLitres) || 0,
        unit: 'litres',
        factor: factors.diesel,
        kg_co2e: result.diesel,
      },
      petrol: {
        qty: Number(petrolLitres) || 0,
        unit: 'litres',
        factor: factors.petrol,
        kg_co2e: result.petrol,
      },
      gas: {
        qty: Number(gasKwh) || 0,
        unit: 'kWh',
        factor: factors.gas,
        kg_co2e: result.gas,
      },
      lpg: {
        qty: Number(lpgKg) || 0,
        unit: 'kg',
        factor: factors.lpgKg,
        kg_co2e: result.lpg,
      },
      cng: {
        qty: Number(cngKg) || 0,
        unit: 'kg',
        factor: factors.cngKg,
        kg_co2e: result.cng,
      },
      refrigerant: {
        qty: Number(refrigerantKg) || 0,
        unit: 'kg',
        type: refrigerantType || 'GENERIC_HFC',
        factor: factors.refrigerants[refrigerantType] ?? 0,
        kg_co2e: result.refrigerant,
      },
      total_kg_co2e: result.total,
      country_code: countryCode,
      factor_version: factors.version,
      calculated_at: new Date().toISOString(),
    };

    // 4. Insert
    const { error } = await supabase.from('emissions').insert({
      user_id,
      month,
      electricity_kw:   Number(electricityKwh)  || 0,
      diesel_litres:    Number(dieselLitres)    || 0,
      petrol_litres:    Number(petrolLitres)    || 0,
      gas_kwh:          Number(gasKwh)          || 0,
      lpg_kg:           Number(lpgKg)           || 0,
      cng_kg:           Number(cngKg)           || 0,
      refrigerant_kg:   Number(refrigerantKg)   || 0,
      refrigerant_code: refrigerantType || 'GENERIC_HFC',
      total_co2e:       result.total,
      country_code:     countryCode,
      data_source:      'manual',
      ef_version:       factors.version,
      ef_electricity:   factors.electricity,
      ef_diesel:        factors.diesel,
      ef_petrol:        factors.petrol,
      ef_gas:           factors.gas,
      ef_lpg:           factors.lpgKg,
      ef_cng:           factors.cngKg,
      ef_refrigerant:   factors.refrigerants[refrigerantType] ?? null,
      calc_breakdown,
    });

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 5. Refrigerant watch check (background, non-blocking)
    if (user_id) {
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      checkRefrigerantWatch(serviceClient, user_id).catch(err =>
        console.error('[REFRIGERANT-WATCH] error:', err)
      );
    }

    // 6. AI auto-refresh (background, non-blocking)
    if (user_id) {
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id }),
      }).catch(() => {});
    }

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