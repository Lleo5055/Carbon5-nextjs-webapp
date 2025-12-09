import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return NextResponse.json({ benchmarking: null }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('ai_benchmarking')
      .select('benchmarking')
      .eq('user_id', user_id)
      .single();

    if (error || !data) {
      return NextResponse.json({ benchmarking: null });
    }

    return NextResponse.json({
      benchmarking: data.benchmarking ?? null,
    });
  } catch (err) {
    console.error('GET AI Benchmarking Error:', err);
    return NextResponse.json({ benchmarking: null }, { status: 500 });
  }
}
