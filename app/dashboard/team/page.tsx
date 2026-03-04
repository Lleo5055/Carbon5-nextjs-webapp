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

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function TeamPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const token = await getAuthToken();
      if (!token) { setLoading(false); return; }

      // Get current user email
      const { data: { user } } = await supabase.auth.getUser();
      setOwnerEmail(user?.email ?? '');

      // Get plan
      const { data: planRow } = await supabase
        .from('user_plans')
        .select('plan')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPlan((planRow?.plan as Plan) ?? 'free');

      // Get team members
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
    setInviteSuccess(false);

    const token = await getAuthToken();
    if (!token) { setInviteError('Not authenticated.'); setInviting(false); return; }

    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });

    const json = await res.json();
    if (!res.ok) {
      setInviteError(json.error ?? 'Failed to send invite.');
    } else {
      setInviteSuccess(true);
      setInviteEmail('');
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

  if (loading) return <p className="p-6 text-sm text-slate-500">Loading...</p>;

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
          Invite colleagues to view or manage your company's emissions data.
        </p>

        {!isPro ? (
          /* Upgrade prompt for non-Pro users */
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

            {/* Invite form */}
            <div className="rounded-xl bg-white border border-slate-200 shadow p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Invite a team member</h2>
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
                {inviteSuccess && (
                  <p className="text-xs text-emerald-600">Invite sent! They'll receive an email shortly.</p>
                )}

                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full rounded-full bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {inviting ? 'Sending…' : 'Send invite →'}
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
                  {/* Owner row */}
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
                        No team members yet. Send your first invite above.
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
                          {m.status === 'active' ? 'Remove' : 'Revoke'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Info box */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-600">How it works:</strong> Invited members receive an
              email to create their account. Once they sign in, they'll automatically see your
              company's emissions data. Admins can add and edit data; Viewers can only read reports.
              Removing a member revokes their access immediately.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
