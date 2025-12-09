import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    // 1. Get authed user
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

    // 2. Read body
    const body = await req.json();
    const {
      id,
      monthName,
      year,
      electricityKwh,
      dieselLitres,
      petrolLitres,
      gasKwh,
      refrigerantKg,
      refrigerantCode,
    } = body;

    const monthLabel = `${monthName} ${year}`;

    const payload = {
      user_id: user.id,
      month: monthLabel,
      electricity_kw: Number(electricityKwh) || 0,
      diesel_litres: Number(dieselLitres) || 0,
      petrol_litres: Number(petrolLitres) || 0,
      gas_kwh: Number(gasKwh) || 0,
      refrigerant_kg: Number(refrigerantKg) || 0,
      refrigerant_code: refrigerantCode || 'GENERIC_HFC',
      total_co2e: 0,
    };

    // 3. Insert or Update
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

    // 4. 🔁 AI AUTO-REFRESH (runs silently in background)
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    }).catch(() => {
      // Ignore background errors
    });

    // 5. Respond success
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('UNEXPECTED SAVE ERROR:', err);
    return NextResponse.json(
      { ok: false, error: 'Unexpected error' },
      { status: 500 }
    );
  }
}
