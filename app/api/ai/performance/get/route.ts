import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Server-side Supabase client for API routes only
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return NextResponse.json({ performance: null }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ai_performance')
      .select('performance')
      .eq('user_id', user_id)
      .single();

    if (error || !data) {
      return NextResponse.json({ performance: null });
    }

    return NextResponse.json({
      performance: data.performance ?? null,
    });
  } catch (err) {
    console.error('GET AI Performance Error:', err);
    return NextResponse.json({ performance: null }, { status: 500 });
  }
}
