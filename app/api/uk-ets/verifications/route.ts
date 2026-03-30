import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function makeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  );
}

async function resolveUserId(supabase: ReturnType<typeof makeClient>, token: string, claimedUserId: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user || user.id !== claimedUserId) return null;
  return user.id;
}

// GET /api/uk-ets/verifications?userId=...&installationId=...
export async function GET(req: NextRequest) {
  const supabase = makeClient();
  const userId = req.nextUrl.searchParams.get('userId');
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? req.nextUrl.searchParams.get('token');
  const installationId = req.nextUrl.searchParams.get('installationId');

  if (!userId || !token) return new NextResponse('Unauthorized', { status: 401 });
  const verified = await resolveUserId(supabase, token, userId);
  if (!verified) return new NextResponse('Unauthorized', { status: 401 });

  // Verify the installation belongs to this user
  const { data: installation } = await supabase
    .from('uk_ets_installations')
    .select('id')
    .eq('profile_id', userId)
    .eq('id', installationId ?? '')
    .maybeSingle();

  if (!installation) return NextResponse.json({ error: 'Installation not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('uk_ets_verifications')
    .select('*')
    .eq('installation_id', installation.id)
    .order('reporting_year', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/uk-ets/verifications  (create or upsert)
export async function POST(req: NextRequest) {
  const supabase = makeClient();
  const body = await req.json() as {
    userId: string;
    token: string;
    installation_id: string;
    reporting_year: number;
    status?: string;
    verifier_name?: string | null;
    verifier_accreditation?: string | null;
    verification_body?: string | null;
    verification_opinion?: string | null;
    material_misstatements?: boolean;
    findings?: string | null;
    verified_emissions?: number | null;
    free_allocation?: number | null;
    purchased_allowances?: number | null;
    surrendered_allowances?: number | null;
    surrender_deadline?: string | null;
    surrender_status?: string | null;
    submitted_at?: string | null;
    verified_at?: string | null;
  };

  const { userId, token } = body;
  if (!userId || !token) return new NextResponse('Unauthorized', { status: 401 });
  const verified = await resolveUserId(supabase, token, userId);
  if (!verified) return new NextResponse('Unauthorized', { status: 401 });

  // Verify installation belongs to user
  const { data: installation } = await supabase
    .from('uk_ets_installations')
    .select('id')
    .eq('id', body.installation_id)
    .eq('profile_id', userId)
    .maybeSingle();

  if (!installation) return NextResponse.json({ error: 'Installation not found' }, { status: 404 });

  const { userId: _u, token: _t, ...fields } = body;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('uk_ets_verifications')
    .upsert(
      { ...fields, updated_at: now },
      { onConflict: 'installation_id,reporting_year' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PUT /api/uk-ets/verifications?id=...
export async function PUT(req: NextRequest) {
  const supabase = makeClient();
  const verificationId = req.nextUrl.searchParams.get('id');
  if (!verificationId) return new NextResponse('Missing id', { status: 400 });

  const body = await req.json() as {
    userId: string;
    token: string;
    status?: string;
    verifier_name?: string | null;
    verifier_accreditation?: string | null;
    verification_body?: string | null;
    verification_opinion?: string | null;
    material_misstatements?: boolean;
    findings?: string | null;
    verified_emissions?: number | null;
    free_allocation?: number | null;
    purchased_allowances?: number | null;
    surrendered_allowances?: number | null;
    surrender_deadline?: string | null;
    surrender_status?: string | null;
    submitted_at?: string | null;
    verified_at?: string | null;
  };

  const { userId, token } = body;
  if (!userId || !token) return new NextResponse('Unauthorized', { status: 401 });
  const verified = await resolveUserId(supabase, token, userId);
  if (!verified) return new NextResponse('Unauthorized', { status: 401 });

  const { userId: _u, token: _t, ...fields } = body;

  // Verify the verification row's installation belongs to this user
  const { data: ver } = await supabase
    .from('uk_ets_verifications')
    .select('installation_id')
    .eq('id', verificationId)
    .single();

  if (!ver) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: inst } = await supabase
    .from('uk_ets_installations')
    .select('id')
    .eq('id', ver.installation_id)
    .eq('profile_id', userId)
    .maybeSingle();

  if (!inst) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabase
    .from('uk_ets_verifications')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', verificationId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}