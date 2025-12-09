import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1️⃣ Parse incoming JSON
    const body = await req.json();

    // 2️⃣ Read auth token from request (client sends it automatically)
    const authHeader = req.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing auth token' },
        { status: 401 }
      );
    }

    // 3️⃣ Get logged-in user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = user.id;

    // 4️⃣ Clean body (remove empty values)
    const clean = Object.fromEntries(
      Object.entries(body).filter(([_, v]) => v !== '' && v !== undefined)
    );

    if (Object.keys(clean).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided' },
        { status: 400 }
      );
    }

    // 5️⃣ Update profiles table
    const { error } = await supabase
      .from('profiles')
      .update(clean)
      .eq('id', userId);

    if (error) {
      console.error('Profile update error:', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated_fields: clean,
    });
  } catch (err: any) {
    console.error('Profile update thrown error:', err);
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
