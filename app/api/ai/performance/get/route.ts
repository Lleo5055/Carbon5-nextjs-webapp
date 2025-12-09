import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return NextResponse.json({ performance: null }, { status: 400 });
    }

    const { data, error } = await supabaseServer
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
