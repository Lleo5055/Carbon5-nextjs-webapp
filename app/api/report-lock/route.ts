import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { userId, month, locked } = await req.json();

  // strict validation
  if (!userId || !month || typeof locked !== 'boolean') {
    return NextResponse.json(
      { error: 'Invalid request payload' },
      { status: 400 }
    );
  }

  // ONLY update an existing row
  const { error } = await supabase
    .from('report_locks')
    .update({ locked })
    .eq('user_id', userId)
    .eq('month', month);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
