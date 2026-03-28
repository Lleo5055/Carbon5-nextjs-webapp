'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import BlogCoverImage from '@/components/blog/BlogCoverImage';
import type { BlogMeta } from '@/lib/blog/types';

const LEVEL_LABELS: Record<number, string> = {
  1: 'Pillar',
  2: 'Country',
  3: 'Intermediate',
  4: 'Advanced',
};

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-purple-100 text-purple-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-rose-100 text-rose-700',
};

const PAGE_SIZE = 12;

interface Props {
  posts: BlogMeta[];
}

export default function BlogListClient({ posts }: Props) {
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('All');
  const [levelFilter, setLevelFilter] = useState('All');
  const [page, setPage] = useState(1);

  const countries = useMemo(() => {
    const unique = Array.from(new Set(posts.map(p => p.country))).sort();
    return ['All', ...unique];
  }, [posts]);

const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return posts.filter(p => {
      if (countryFilter !== 'All' && p.country !== countryFilter) return false;
      if (levelFilter !== 'All' && String(p.level) !== levelFilter) return false;
      if (
        q &&
        !p.title.toLowerCase().includes(q) &&
        !p.excerpt?.toLowerCase().includes(q) &&
        !p.keywords?.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [posts, search, countryFilter, levelFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <div>
      {/* ── FILTERS ── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="flex flex-1 max-w-sm items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-200">
          <svg
            className="h-4 w-4 shrink-0 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search articles…"
            value={search}
            onChange={e => handleFilter(setSearch, e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Country filter */}
          <select
            value={countryFilter}
            onChange={e => handleFilter(setCountryFilter, e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            {countries.map(c => (
              <option key={c} value={c}>
                {c === 'All' ? '🌍 All Countries' : c}
              </option>
            ))}
          </select>

          {/* Level filter */}
          <select
            value={levelFilter}
            onChange={e => handleFilter(setLevelFilter, e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            <option value="All">All Levels</option>
            <option value="1">Pillar Guide</option>
            <option value="2">Country Guide</option>
            <option value="3">Intermediate</option>
            <option value="4">Advanced</option>
          </select>
        </div>
      </div>

      {/* ── RESULTS COUNT ── */}
      <p className="mb-6 text-sm text-slate-500">
        {filtered.length === 0
          ? 'No articles found.'
          : `${filtered.length} article${filtered.length !== 1 ? 's' : ''}`}
      </p>

      {/* ── GRID ── */}
      {paginated.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-20 text-center text-slate-400">
          No articles match your filters.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {paginated.map(post => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
            >
              {/* Cover thumbnail */}
              <div className="p-3 pb-0">
                <BlogCoverImage
                  compact
                  title={post.title}
                  flag={post.flag}
                  country={post.country}
                  regulation={post.regulation ?? ''}
                  levelLabel={post.levelLabel ?? LEVEL_LABELS[post.level] ?? ''}
                  readingTime={post.readingTime}
                />
              </div>

              {/* Meta */}
              <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-400">
                <span>{post.country}</span>
                <span>
                  {new Date(post.date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── PAGINATION ── */}
      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Prev
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                p === currentPage
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
