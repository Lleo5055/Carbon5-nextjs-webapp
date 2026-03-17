import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { getFactorsForCountry } from '@/lib/factors';
import { calculateCo2e } from '@/lib/calcCo2e';

export async function POST(req: NextRequest) {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Not signed in' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      id,
      monthName,
      year,
      electricityKwh,
      dieselLitres,
      petrolLitres,
      gasKwh,
      lpgKg,
      cngKg,
      refrigerantKg,
      refrigerantCode,
      efVersion,
      dataSource,
    } = body;

    const monthLabel = `${monthName} ${year}`;

    // 1. Load country-aware factors
    const { data: profile } = await supabase
      .from('profiles')
      .select('country')
      .eq('id', user.id)
      .single();

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
        refrigerantType: refrigerantCode || 'GENERIC_HFC',
        refrigerantKg:   Number(refrigerantKg)   || 0,
      },
      factors
    );

    // 3. Build calc_breakdown — the CCTS audit chain
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
        type: refrigerantCode || 'GENERIC_HFC',
        factor: factors.refrigerants[refrigerantCode] ?? 0,
        kg_co2e: result.refrigerant,
      },
      total_kg_co2e: result.total,
      country_code: countryCode,
      factor_version: factors.version,
      calculated_at: new Date().toISOString(),
    };

    // 4. Build payload
    const payload: Record<string, unknown> = {
      user_id:          user.id,
      month:            monthLabel,
      electricity_kw:   Number(electricityKwh)  || 0,
      diesel_litres:    Number(dieselLitres)    || 0,
      petrol_litres:    Number(petrolLitres)    || 0,
      gas_kwh:          Number(gasKwh)          || 0,
      lpg_kg:           Number(lpgKg)           || 0,
      cng_kg:           Number(cngKg)           || 0,
      refrigerant_kg:   Number(refrigerantKg)   || 0,
      refrigerant_code: refrigerantCode || 'GENERIC_HFC',
      total_co2e:       result.total,
      country_code:     countryCode,
      data_source:      dataSource || 'manual',
      // Factor snapshot
      ef_electricity:   factors.electricity,
      ef_diesel:        factors.diesel,
      ef_petrol:        factors.petrol,
      ef_gas:           factors.gas,
      ef_lpg:           factors.lpgKg,
      ef_cng:           factors.cngKg,
      ef_refrigerant:   factors.refrigerants[refrigerantCode] ?? null,
      calc_breakdown,
    };

    // ef_version only stamped on new inserts — never overwrite on edit
    if (!id && efVersion) {
      payload.ef_version = efVersion;
    }
    // Also stamp from factors.version if ef_version not passed
    if (!id && !efVersion) {
      payload.ef_version = factors.version;
    }

    // 5. Insert or update
    let error = null;

    if (id) {
      const { error: updateError } = await supabase
        .from('emissions')
        .update(payload)
        .eq('id', id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('emissions')
        .insert(payload);
      error = insertError;
    }

    if (error) {
      console.error('SAVE ERROR:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    // 6. AI auto-refresh (background, non-blocking)
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('UNEXPECTED SAVE ERROR:', err);
    return NextResponse.json(
      { ok: false, error: 'Unexpected error' },
      { status: 500 }
    );
  }
}