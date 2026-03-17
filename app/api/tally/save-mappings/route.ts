import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) } }
    );

    const { userId, token, mappings } = await req.json();

    if (!userId || !token || !mappings) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = mappings.map((m: any) => ({
      user_id: userId,
      tally_ledger_name: m.tally_ledger_name,
      emission_source: m.skip ? null : m.emission_source,
      skip: m.skip ?? false,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('tally_ledger_mappings')
      .upsert(rows, { onConflict: 'user_id,tally_ledger_name' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Save mappings error:', err);
    return NextResponse.json({ error: 'Failed to save mappings' }, { status: 500 });
  }
}
