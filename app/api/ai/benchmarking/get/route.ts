import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Server-side Supabase client (safe in API routes only)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // never expose to client
);

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return NextResponse.json({ benchmarking: null }, { status: 400 });
    }

    const { data, error } = await supabase
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
