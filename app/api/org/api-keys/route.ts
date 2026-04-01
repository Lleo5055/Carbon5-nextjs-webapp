import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireOrgRole } from '@/lib/orgAuth';
import { generateApiKey } from '@/lib/apiKeyAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── GET — list all keys for org (no key_hash returned) ──────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    const authResult = await requireOrgRole(request, orgId, 'admin');
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { data: keys, error } = await adminSupabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, is_active, created_at, last_used_at, expires_at')
      .eq('org_id', orgId!)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(keys ?? []);
  } catch (err: any) {
    console.error('[api-keys GET]', err.message);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}

// ─── POST — create new key ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    const authResult = await requireOrgRole(request, orgId, 'admin');
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { name, scopes, expires_in_days } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const resolvedScopes: string[] = Array.isArray(scopes) && scopes.length > 0
      ? scopes
      : ['read'];

    const { key, hash, prefix } = generateApiKey();

    let expiresAt: string | null = null;
    if (expires_in_days && Number(expires_in_days) > 0) {
      const d = new Date();
      d.setDate(d.getDate() + Number(expires_in_days));
      expiresAt = d.toISOString();
    }

    const { data: keyData, error: insertError } = await adminSupabase
      .from('api_keys')
      .insert({
        org_id: orgId,
        name: name.trim(),
        key_hash: hash,
        key_prefix: prefix,
        scopes: resolvedScopes,
        is_active: true,
        created_by: authResult.userId,
        expires_at: expiresAt,
      })
      .select('id, name, key_prefix, scopes, created_at')
      .single();

    if (insertError) {
      console.error('[api-keys POST] insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Return the full key ONCE — it is never stored in plain text and cannot be retrieved again
    return NextResponse.json({ key, keyData });
  } catch (err: any) {
    console.error('[api-keys POST]', err.message);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE — revoke key ──────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const keyId = searchParams.get('key_id');

    if (!keyId) {
      return NextResponse.json({ error: 'key_id is required' }, { status: 400 });
    }

    const authResult = await requireOrgRole(request, orgId, 'admin');
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { error } = await adminSupabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId)
      .eq('org_id', orgId!);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api-keys DELETE]', err.message);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}