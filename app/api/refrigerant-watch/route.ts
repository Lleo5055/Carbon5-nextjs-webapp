import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRefrigerantWatch } from '@/lib/refrigerantWatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { user_id } = await req.json();
    if (!user_id) return NextResponse.json({ ok: false }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    await checkRefrigerantWatch(supabase, user_id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[REFRIGERANT-WATCH] error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
