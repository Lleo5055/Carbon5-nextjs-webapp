'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Application = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  website: string | null;
  how_they_refer: string | null;
  status: string;
  created_at: string;
};

export default function AdminPartnersPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const adminEmails = ['hello@greenio.co'];
      if (!data.session || !adminEmails.includes(data.session.user.email ?? '')) {
        setLoading(false);
        return;
      }
      setIsAdmin(true);
      setToken(data.session.access_token);
      loadApplications();
    });
  }, []);

  async function loadApplications() {
    setLoading(true);
    const { data } = await supabase
      .from('affiliate_applications')
      .select('*')
      .order('created_at', { ascending: false });
    setApplications(data ?? []);
    setLoading(false);
  }

  async function approve(id: string) {
    if (!token) return;
    setActionLoading(id);
    const res = await fetch('/api/admin/partners/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ application_id: id }),
    });
    if (res.ok) {
      setApplications(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' } : a));
    } else {
      alert(await res.text());
    }
    setActionLoading(null);
  }

  async function reject(id: string) {
    if (!token) return;
    setActionLoading(id);
    const res = await fetch('/api/admin/partners/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ application_id: id }),
    });
    if (res.ok) {
      setApplications(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' } : a));
    } else {
      alert(await res.text());
    }
    setActionLoading(null);
  }

  if (loading) return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-3xl space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        {[1,2,3].map(i => <div key={i} className="h-16 bg-white border border-slate-200 rounded-xl" />)}
      </div>
    </main>
  );
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Access denied.</div>;

  const filtered = applications.filter(a => a.status === filter);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-emerald-600">Admin</p>
          <h1 className="text-xl font-semibold text-slate-900">Partner Applications</h1>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize ${
                filter === s
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s} ({applications.filter(a => a.status === s).length})
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-400">
            No {filter} applications.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(app => (
              <div key={app.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{app.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                        app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        app.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-red-100 text-red-700'
                      }`}>{app.status}</span>
                    </div>
                    <p className="text-sm text-slate-500">{app.email}</p>
                    {app.company && <p className="text-sm text-slate-500">{app.company}</p>}
                    {app.website && (
                      <a href={app.website} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-emerald-600 hover:underline">{app.website}</a>
                    )}
                    {app.how_they_refer && (
                      <p className="text-sm text-slate-600 mt-2 bg-slate-50 rounded-lg p-3">
                        {app.how_they_refer}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      Applied {new Date(app.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {app.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => reject(app.id)}
                        disabled={actionLoading === app.id}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => approve(app.id)}
                        disabled={actionLoading === app.id}
                        className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {actionLoading === app.id ? 'Processing…' : 'Approve'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
