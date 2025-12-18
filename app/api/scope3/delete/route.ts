import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const { id, month } = await req.json();

    // get user (for audit)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    // DELETE scope 3 row
    const { error } = await supabase
      .from('scope3_activities')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    // ✅ AUDIT EVENT
    await supabase.from('edit_history').insert({
      user_id: user.id,
      month,
      entity: 'scope3',
      entity_id: id,
      action: 'delete',
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
