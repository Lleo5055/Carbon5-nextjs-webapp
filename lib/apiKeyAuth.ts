import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  const key = `gro_live_${random}`;
  const hash = hashApiKey(key);
  const prefix = key.slice(0, 16); // "gro_live_" + 7 chars
  return { key, hash, prefix };
}

export type ApiKeyAuthResult =
  | { ok: true; orgId: string; scopes: string[]; keyId: string }
  | { ok: false; status: 401 | 403; error: string };

export async function authenticateApiKey(request: Request): Promise<ApiKeyAuthResult> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer gro_live_')) {
    return { ok: false, status: 401, error: 'Missing or invalid Authorization header' };
  }

  const key = authHeader.slice(7); // strip "Bearer "
  const hash = hashApiKey(key);

  const { data: apiKey, error } = await adminSupabase
    .from('api_keys')
    .select('id, org_id, scopes, is_active, expires_at')
    .eq('key_hash', hash)
    .single();

  if (error || !apiKey) {
    return { ok: false, status: 401, error: 'Invalid API key' };
  }

  if (!apiKey.is_active) {
    return { ok: false, status: 403, error: 'API key has been revoked' };
  }

  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return { ok: false, status: 403, error: 'API key has expired' };
  }

  // Update last_used_at asynchronously — don't await, don't block response
  adminSupabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id);

  return { ok: true, orgId: apiKey.org_id, scopes: apiKey.scopes ?? ['read'], keyId: apiKey.id };
}