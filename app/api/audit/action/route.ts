import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type AuditToken = {
  package_id: string;
  org_id: string;
  auditor_email: string;
  exp: number;
};

function decodeToken(raw: string): AuditToken | null {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString()) as AuditToken;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token: rawToken, action, message, auditor_name } = body;

    if (!rawToken || !action) {
      return NextResponse.json({ error: 'token and action are required' }, { status: 400 });
    }

    if (!['approve', 'request_clarification'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve" or "request_clarification"' },
        { status: 400 }
      );
    }

    // 1. Decode + verify token
    const token = decodeToken(rawToken);
    if (!token) {
      return NextResponse.json({ error: 'Invalid or malformed audit link' }, { status: 400 });
    }
    if (Date.now() > token.exp) {
      return NextResponse.json({ error: 'This audit link has expired' }, { status: 401 });
    }

    // 2. Fetch audit package — verify status is under_review
    const { data: pkg, error: pkgError } = await adminSupabase
      .from('audit_packages')
      .select('*')
      .eq('id', token.package_id)
      .eq('org_id', token.org_id)
      .single();

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Audit package not found' }, { status: 404 });
    }

    if (pkg.status !== 'under_review') {
      return NextResponse.json(
        { error: `Cannot act on a package with status "${pkg.status}"` },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    let newStatus: string;

    // 3. Handle approve
    if (action === 'approve') {
      newStatus = 'verified';
      const { error: updateError } = await adminSupabase
        .from('audit_packages')
        .update({
          status: 'verified',
          verified_at: now,
          verified_by_name: auditor_name ?? pkg.auditor_name,
        })
        .eq('id', token.package_id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      // 4. Handle request_clarification
      if (!message?.trim()) {
        return NextResponse.json(
          { error: 'message is required when requesting clarification' },
          { status: 400 }
        );
      }

      newStatus = 'clarification_requested';

      const { error: updateError } = await adminSupabase
        .from('audit_packages')
        .update({ status: 'clarification_requested' })
        .eq('id', token.package_id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      const { error: commentError } = await adminSupabase
        .from('audit_comments')
        .insert({
          package_id: token.package_id,
          author_type: 'auditor',
          author_name: pkg.auditor_name,
          message: message.trim(),
        });

      if (commentError) {
        console.error('[audit/action] comment insert error:', commentError);
        // Non-fatal — status already updated
      }
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err: any) {
    console.error('[audit/action]', err.message);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}