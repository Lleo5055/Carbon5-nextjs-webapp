import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { userId, month, locked } = await req.json();

  if (!userId || !month || typeof locked !== 'boolean') {
    return NextResponse.json(
      { error: 'Invalid request payload' },
      { status: 400 }
    );
  }

  // Snapshot the emission and scope3 row IDs in scope at lock time
  const [{ data: emissionRows }, { data: scope3Rows }] = await Promise.all([
    supabase
      .from('emissions')
      .select('id')
      .eq('user_id', userId)
      .eq('month', month),
    supabase
      .from('scope3_activities')
      .select('id')
      .eq('user_id', userId)
      .eq('month', month),
  ]);

  const emissionIds = (emissionRows ?? []).map((r) => r.id);
  const scope3Ids = (scope3Rows ?? []).map((r) => r.id);

  // Upsert — creates the row if it doesn't exist, updates if it does
  const { error } = await supabase
    .from('report_locks')
    .upsert(
      {
        user_id: userId,
        month,
        locked,
        locked_at: new Date().toISOString(),
        emission_ids: emissionIds,
        scope3_ids: scope3Ids,
      },
      { onConflict: 'user_id,month' }
    );

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}