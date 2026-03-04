'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

type Member = {
  id: string;
  member_email: string;
  role: 'admin' | 'viewer';
  status: 'pending' | 'active' | 'removed';
  invited_at: string;
  joined_at: string | null;
};

type Plan = 'free' | 'growth' | 'pro' | 'enterprise';

type Credentials = { email: string; password: string };

type MembershipInfo = {
  role: 'admin' | 'viewer';
  ownerEmail: string;
};

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function TeamPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<MembershipInfo | null>(null); // set if current user is a team member

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [alreadyExistsMsg, setAlreadyExistsMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const token = await getAuthToken();
      if (!token) { setLoading(false); return; }

      const { data: { user } } = await supabase.auth.getUser();

      // Check if this user is a team member (not an owner)
      const { data: memberRow } = await supabase
        .from('team_members')
        .select('role, owner_id')
        .eq('member_user_id', user?.id)
        .eq('status', 'active')
        .maybeSingle();

      if (memberRow) {
        // Fetch owner's email from profiles
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('company_name')
          .eq('id', memberRow.owner_id)
          .maybeSingle();
        setMembership({
          role: memberRow.role as 'admin' | 'viewer',
          ownerEmail: ownerProfile?.company_name ?? 'your organisation',
        });
        setLoading(false);
        return;
      }

      // Owner path
      setOwnerEmail(user?.email ?? '');

      const { data: planRow } = await supabase
        .from('user_plans')
        .select('plan')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPlan((planRow?.plan as Plan) ?? 'free');

      const res = await fetch('/api/team/members', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setMembers(json.members ?? []);
      }

      setLoading(false);
    }
    load();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setCredentials(null);
    setAlreadyExistsMsg(null);
    setCopied(false);

    const token = await getAuthToken();
    if (!token) { setInviteError('Not authenticated.'); setInviting(false); return; }

    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });

    const json = await res.json();
    if (!res.ok) {
      setInviteError(json.error ?? 'Failed to add member.');
    } else {
      setInviteEmail('');
      if (json.alreadyExists) {
        setAlreadyExistsMsg(json.message);
      } else {
        setCredentials(json.credentials);
      }
      // Refresh members list
      const membRes = await fetch('/api/team/members', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (membRes.ok) setMembers((await membRes.json()).members ?? []);
    }
    setInviting(false);
  }

  async function handleRemove(memberId: string) {
    setRemovingId(memberId);
    const token = await getAuthToken();
    if (!token) { setRemovingId(null); return; }

    const res = await fetch('/api/team/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ memberId }),
    });

    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
    setRemovingId(null);
  }

  function copyCredentials() {
    if (!credentials) return;
    navigator.clipboard.writeText(
      `You've been added to your team on Greenio.\n\nLogin at: ${window.location.origin}/login\nEmail: ${credentials.email}\nTemporary password: ${credentials.password}\n\nYou can change your password after logging in via account settings.`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) return <p className="p-6 text-sm text-slate-500">Loading...</p>;

  // Team member view — they can't manage the team, just see their membership
  if (membership) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-20">
        <div className="mb-6">
          <a href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900 underline">
            ← Back to dashboard
          </a>
        </div>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Team access</h1>
          <p className="text-sm text-slate-500 mb-8">Your membership details.</p>

          <div className="rounded-xl bg-white border border-slate-200 shadow p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Organisation</span>
              <span className="text-sm font-medium text-slate-800">{membership.ownerEmail}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-600">Your role</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                membership.role === 'admin'
                  ? 'bg-violet-50 text-violet-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {membership.role === 'admin' ? 'Admin' : 'Viewer'}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-600">Status</span>
              <span className="text-xs font-medium text-emerald-600">Active</span>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            {membership.role === 'admin'
              ? 'As an Admin, you can view and add emissions data for this organisation.'
              : 'As a Viewer, you can view reports and dashboards for this organisation.'}
          </p>
        </div>
      </main>
    );
  }

  const isPro = plan === 'pro' || plan === 'enterprise';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-20">
      <div className="mb-6">
        <a href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900 underline">
          ← Back to dashboard
        </a>
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-slate-900">Team access</h1>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
            Pro
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Add colleagues to view or manage your company's emissions data.
        </p>

        {!isPro ? (
          <div className="mt-8 rounded-xl bg-white border border-slate-200 shadow p-8 text-center">
            <p className="text-slate-700 font-medium">Team access is a Pro feature</p>
            <p className="text-sm text-slate-500 mt-1">
              Upgrade to Pro to invite team members and collaborate on your data.
            </p>
            <a
              href="/billing"
              className="mt-4 inline-block rounded-full bg-slate-900 text-white px-6 py-2 text-sm font-medium hover:bg-slate-800"
            >
              Upgrade to Pro →
            </a>
          </div>
        ) : (
          <div className="mt-8 space-y-6">

            {/* Credentials card */}
            {credentials && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-emerald-800">
                    Account created — share these credentials
                  </p>
                  <button
                    onClick={() => setCredentials(null)}
                    className="text-emerald-400 hover:text-emerald-600 text-xl leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="bg-white rounded-lg border border-emerald-200 px-4 py-3 space-y-1.5 font-mono text-sm text-slate-700">
                  <div>
                    <span className="text-slate-400 mr-2">Email</span>
                    {credentials.email}
                  </div>
                  <div>
                    <span className="text-slate-400 mr-2">Password</span>
                    <span className="font-semibold">{credentials.password}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 mr-2">Login at</span>
                    {typeof window !== 'undefined' ? window.location.origin : ''}/login
                  </div>
                </div>
                <button
                  onClick={copyCredentials}
                  className="mt-3 w-full rounded-lg bg-emerald-700 text-white py-2 text-sm font-medium hover:bg-emerald-800 transition-colors"
                >
                  {copied ? '✓ Copied!' : 'Copy credentials to share'}
                </button>
                <p className="mt-2 text-xs text-emerald-700">
                  They can change their password after logging in via account settings.
                </p>
              </div>
            )}

            {/* Already-exists notice */}
            {alreadyExistsMsg && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 flex items-start justify-between gap-3">
                <p className="text-sm text-blue-800">{alreadyExistsMsg}</p>
                <button
                  onClick={() => setAlreadyExistsMsg(null)}
                  className="text-blue-300 hover:text-blue-500 text-xl leading-none shrink-0"
                >
                  ×
                </button>
              </div>
            )}

            {/* Add member form */}
            <div className="rounded-xl bg-white border border-slate-200 shadow p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Add a team member</h2>
              <form onSubmit={handleInvite} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Email address</label>
                  <input
                    type="email"
                    required
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Role</label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'viewer')}
                  >
                    <option value="viewer">Viewer — can view reports and dashboards</option>
                    <option value="admin">Admin — can add and edit emissions data</option>
                  </select>
                </div>

                {inviteError && (
                  <p className="text-xs text-red-600">{inviteError}</p>
                )}

                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {inviting ? 'Creating account…' : 'Add member →'}
                </button>
              </form>
            </div>

            {/* Members table */}
            <div className="rounded-xl bg-white border border-slate-200 shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-700">Current team</h2>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                    <th className="text-left px-6 py-3 font-medium">Email</th>
                    <th className="text-left px-6 py-3 font-medium">Role</th>
                    <th className="text-left px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-50">
                    <td className="px-6 py-3 text-slate-700">{ownerEmail}</td>
                    <td className="px-6 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        Owner
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-xs text-emerald-600 font-medium">Active</span>
                    </td>
                    <td className="px-6 py-3" />
                  </tr>

                  {members.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-6 text-center text-xs text-slate-400">
                        No team members yet. Add your first member above.
                      </td>
                    </tr>
                  )}

                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-6 py-3 text-slate-700">{m.member_email}</td>
                      <td className="px-6 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          m.role === 'admin'
                            ? 'bg-violet-50 text-violet-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {m.status === 'active' ? (
                          <span className="text-xs text-emerald-600 font-medium">Active</span>
                        ) : (
                          <span className="text-xs text-amber-500 font-medium">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => handleRemove(m.id)}
                          disabled={removingId === m.id}
                          className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Info box */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-600">How it works:</strong> Enter a colleague's email
              and a temporary password is generated for them. Share the credentials directly —
              they log in at <span className="font-medium text-slate-600">/login</span> and can
              change their password any time. Admins can add and edit data; Viewers can only read
              reports. Removing a member revokes their access immediately.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
