// app/dashboard/emissions/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id) {
    console.error('Missing id for delete');
    return NextResponse.redirect(
      new URL('/dashboard/emissions/view-emissions', req.url)
    );
  }

  // 1. Get user (needed for AI refresh)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('User not authenticated for delete');
  }

  // 2. Fetch month label for toast
  const { data: row, error: fetchError } = await supabase
    .from('emissions')
    .select('month')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.error('Error fetching row before delete', fetchError);
  }

  const monthLabel = (row?.month as string) || '';

  // 3. Perform delete
  const { error } = await supabase.from('emissions').delete().eq('id', id);

  if (error) {
    console.error('Error deleting emission row', error);
  }

  // 4. 🔁 AI AUTO-REFRESH (background, non-blocking)
  if (user?.id) {
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    }).catch(() => {
      // swallow any background errors
    });
  }

  // 5. Build redirect URL
  const redirectUrl = new URL('/dashboard/emissions/view-emissions', req.url);
  redirectUrl.searchParams.set('period', 'all');

  if (monthLabel) {
    redirectUrl.searchParams.set('deleted', '1');
    redirectUrl.searchParams.set('deletedMonth', monthLabel);
  }

  return NextResponse.redirect(redirectUrl);
}
