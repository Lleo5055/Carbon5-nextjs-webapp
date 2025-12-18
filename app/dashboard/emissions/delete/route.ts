import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.redirect(
        new URL('/dashboard/emissions/view-emissions', req.url)
      );
    }

    // 1. Get user (for AI refresh)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 2. Fetch month label BEFORE delete (for toast)
    const { data: row } = await supabase
      .from('emissions')
      .select('month')
      .eq('id', id)
      .single();

    const monthLabel = (row?.month as string) || '';

    // 3. Delete emission
    await supabase.from('emissions').delete().eq('id', id);

    // 4. AI refresh (fire-and-forget)
    if (user?.id && process.env.NEXT_PUBLIC_BASE_URL) {
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      }).catch(() => {});
    }

    // 5. ✅ CORRECT REDIRECT (App Router safe)
    const redirectUrl = new URL(
      '/dashboard/emissions/view-emissions',
      req.url
    );

    if (monthLabel) {
      redirectUrl.searchParams.set('deleted', '1');
      redirectUrl.searchParams.set('deletedMonth', monthLabel);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (e) {
    console.error('Delete route failed', e);
    return NextResponse.redirect(
      new URL('/dashboard/emissions/view-emissions', req.url)
    );
  }
}
