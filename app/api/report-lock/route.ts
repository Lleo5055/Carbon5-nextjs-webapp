import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { userId, month, locked } = await req.json();

  if (!userId || !month) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  await supabase.from('report_locks').upsert({
    user_id: userId,
    month,
    locked,
  });

  return NextResponse.json({ ok: true });
}
