import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getFactorsForCountry } from '@/lib/factors';
import { calcRefrigerantCo2e } from '@/lib/emissionFactors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) } }
    );

    const { userId, token, rows } = await req.json();

    if (!userId || !token || !rows) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('country, contact_name')
      .eq('id', userId)
      .single();

    const ef = getFactorsForCountry(profile?.country ?? 'GB');
    const actorName: string = profile?.contact_name ?? '';

    const results = { saved: 0, updated: 0, errors: [] as string[] };

    for (const row of rows) {
      try {
        const monthKey = `${row.month_key}-01`;

        // Use final consolidated values (existing + upload) for all calculations
        const finalDiesel = row.is_update ? (row.final_diesel ?? row.diesel) : row.diesel;
        const finalPetrol = row.is_update ? (row.final_petrol ?? row.petrol) : row.petrol;
        const finalLpg = row.is_update ? (row.final_lpg ?? row.lpg) : row.lpg;
        const finalCng = row.is_update ? (row.final_cng ?? row.cng) : row.cng;
        const finalGas = row.is_update ? (row.final_gas ?? row.gas) : row.gas;
        const finalElec = row.is_update ? (row.final_electricity ?? row.electricity) : row.electricity;
        const finalRefrig = row.is_update ? (row.final_refrigerant ?? row.refrigerant) : row.refrigerant;

        const fuelCo2 =
          finalDiesel * ef.diesel +
          finalPetrol * ef.petrol +
          finalLpg * ef.lpgKg +
          finalCng * ef.cngKg +
          finalGas * ef.gas;

        const elecCo2 = finalElec * ef.electricity;
        const refrigCo2 = calcRefrigerantCo2e(finalRefrig, row.refrigerant_code || 'GENERIC_HFC');
        const totalCo2e = fuelCo2 + elecCo2 + refrigCo2;

        const calcBreakdown = {
          diesel: finalDiesel > 0 ? { qty: finalDiesel, unit: 'L', ef: ef.diesel, co2e_kg: finalDiesel * ef.diesel } : null,
          petrol: finalPetrol > 0 ? { qty: finalPetrol, unit: 'L', ef: ef.petrol, co2e_kg: finalPetrol * ef.petrol } : null,
          lpg: finalLpg > 0 ? { qty: finalLpg, unit: 'kg', ef: ef.lpgKg, co2e_kg: finalLpg * ef.lpgKg } : null,
          cng: finalCng > 0 ? { qty: finalCng, unit: 'kg', ef: ef.cngKg, co2e_kg: finalCng * ef.cngKg } : null,
          gas: finalGas > 0 ? { qty: finalGas, unit: 'kWh', ef: ef.gas, co2e_kg: finalGas * ef.gas } : null,
          electricity: finalElec > 0 ? { qty: finalElec, unit: 'kWh', ef: ef.electricity, co2e_kg: elecCo2 } : null,
          refrigerant: finalRefrig > 0 ? { qty: finalRefrig, unit: 'kg', code: row.refrigerant_code, co2e_kg: refrigCo2 } : null,
          total_co2e_kg: totalCo2e,
          calculated_at: new Date().toISOString(),
          ef_version: ef.version,
          source: row.is_update ? 'bulk_upload_consolidated' : 'bulk_upload',
        };

        const payload = {
          user_id: userId,
          month: row.month,
          month_key: monthKey,
          electricity_kw: finalElec,
          diesel_litres: finalDiesel,
          petrol_litres: finalPetrol,
          gas_kwh: finalGas,
          lpg_kg: finalLpg,
          cng_kg: finalCng,
          refrigerant_kg: finalRefrig,
          refrigerant_code: row.refrigerant_code || 'GENERIC_HFC',
          total_co2e: totalCo2e,
          data_source: row.is_update ? 'bulk_upload_consolidated' : 'bulk_upload',
          ef_version: ef.version,
          ef_electricity: ef.electricity,
          ef_diesel: ef.diesel,
          ef_petrol: ef.petrol,
          ef_gas: ef.gas,
          ef_lpg: ef.lpgKg,
          ef_cng: ef.cngKg,
          calc_breakdown: calcBreakdown,
        };

        if (row.is_update) {
          const { data: existingRecord } = await supabase
            .from('emissions')
            .select('id, electricity_kw, diesel_litres, petrol_litres, lpg_kg, cng_kg, gas_kwh, refrigerant_kg, total_co2e')
            .eq('user_id', userId)
            .eq('month', row.month)
            .maybeSingle();

          if (existingRecord) {
            await supabase.from('emissions').update(payload).eq('id', existingRecord.id);
            await supabase.from('edit_history').insert({
              user_id: userId,
              month: row.month,
              entity: 'emissions',
              entity_id: existingRecord.id,
              action: 'bulk_update_consolidated',
              before: {
                electricity_kw: existingRecord.electricity_kw,
                diesel_litres: existingRecord.diesel_litres,
                petrol_litres: existingRecord.petrol_litres,
                lpg_kg: existingRecord.lpg_kg,
                cng_kg: existingRecord.cng_kg,
                gas_kwh: existingRecord.gas_kwh,
                refrigerant_kg: existingRecord.refrigerant_kg,
                total_co2e: existingRecord.total_co2e,
              },
              after: {
                electricity_kw: finalElec,
                diesel_litres: finalDiesel,
                petrol_litres: finalPetrol,
                lpg_kg: finalLpg,
                cng_kg: finalCng,
                gas_kwh: finalGas,
                refrigerant_kg: finalRefrig,
                total_co2e: totalCo2e,
              },
            });
            await supabase.from('activity_log').insert({
              owner_id: userId,
              actor_id: userId,
              actor_name: actorName,
              action: 'bulk_update',
              resource: 'emission',
              detail: { month: row.month, co2e_kg: totalCo2e },
            });
            results.updated++;
          }
        } else {
          const { data: inserted } = await supabase
            .from('emissions')
            .insert(payload)
            .select('id')
            .single();

          await supabase.from('edit_history').insert({
            user_id: userId,
            month: row.month,
            entity: 'emissions',
            entity_id: inserted?.id ?? null,
            action: 'bulk_upload',
          });
          await supabase.from('activity_log').insert({
            owner_id: userId,
            actor_id: userId,
            actor_name: actorName,
            action: 'bulk_upload',
            resource: 'emission',
            detail: { month: row.month, co2e_kg: totalCo2e },
          });
          results.saved++;
        }

        // Save production output if provided
        if (row.production_output && row.production_output > 0) {
          const MONTH_NUMS: Record<string, string> = {
            January: '01', February: '02', March: '03', April: '04',
            May: '05', June: '06', July: '07', August: '08',
            September: '09', October: '10', November: '11', December: '12',
          };
          const parts = row.month.split(' ');
          const prodMonthKey = `${parts[1]}-${MONTH_NUMS[parts[0]] ?? '01'}-01`;

          const { data: existingProd } = await supabase
            .from('production_entries')
            .select('id')
            .eq('user_id', userId)
            .eq('month_key', prodMonthKey)
            .maybeSingle();

          if (existingProd) {
            await supabase
              .from('production_entries')
              .update({ quantity: row.production_output, unit: row.production_unit ?? 'tonnes', updated_at: new Date().toISOString() })
              .eq('id', existingProd.id);
          } else {
            await supabase
              .from('production_entries')
              .insert({
                user_id: userId,
                month: row.month,
                month_key: prodMonthKey,
                quantity: row.production_output,
                unit: row.production_unit ?? 'tonnes',
              });
          }
        }

        // Auto-lock the month
        await supabase.from('report_locks').upsert({
          user_id: userId,
          month: row.month,
          locked: true,
          locked_at: new Date().toISOString(),
        }, { onConflict: 'user_id,month' });

      } catch (rowErr: any) {
        results.errors.push(`${row.month}: ${rowErr.message}`);
      }
    }

    return NextResponse.json({ ok: true, ...results });

  } catch (err: any) {
    console.error('Bulk upload save error:', err);
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}
