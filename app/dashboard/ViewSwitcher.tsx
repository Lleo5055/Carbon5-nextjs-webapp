'use client';

import React from 'react';
import type { EnterpriseViewState } from '@/lib/enterpriseView';
import { saveViewState } from '@/lib/enterpriseView';

interface EntityOption { id: string; name: string; }
interface SiteOption { id: string; name: string; entity_id: string; }

interface Props {
  entities: EntityOption[];
  sites: SiteOption[];
  value: EnterpriseViewState;
  onChange: (state: EnterpriseViewState) => void;
}

export default function ViewSwitcher({ entities, sites, value, onChange }: Props) {
  const filteredSites = value.entityId
    ? sites.filter((s) => s.entity_id === value.entityId)
    : sites;

  function setMode(mode: EnterpriseViewState['mode']) {
    const next: EnterpriseViewState = { mode };
    if (mode === 'entity' && entities[0]) {
      next.entityId = entities[0].id;
      next.entityName = entities[0].name;
    }
    if (mode === 'site' && entities[0]) {
      next.entityId = entities[0].id;
      next.entityName = entities[0].name;
      const firstSite = sites.find((s) => s.entity_id === entities[0].id);
      if (firstSite) {
        next.siteId = firstSite.id;
        next.siteName = firstSite.name;
      }
    }
    saveViewState(next);
    onChange(next);
  }

  function onEntityChange(entityId: string) {
    const entity = entities.find((e) => e.id === entityId);
    const next: EnterpriseViewState = {
      mode: value.mode,
      entityId,
      entityName: entity?.name,
    };
    if (value.mode === 'site') {
      const firstSite = sites.find((s) => s.entity_id === entityId);
      if (firstSite) {
        next.siteId = firstSite.id;
        next.siteName = firstSite.name;
      }
    }
    saveViewState(next);
    onChange(next);
  }

  function onSiteChange(siteId: string) {
    const site = sites.find((s) => s.id === siteId);
    const next: EnterpriseViewState = {
      ...value,
      siteId,
      siteName: site?.name,
    };
    saveViewState(next);
    onChange(next);
  }

  const btnBase = 'px-3 py-1 rounded-full text-[11px] font-medium transition';
  const activeBtn = `${btnBase} bg-slate-900 text-white`;
  const inactiveBtn = `${btnBase} text-slate-600 hover:bg-slate-100`;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-full bg-white/70 border border-slate-200 p-1">
        <button
          type="button"
          className={value.mode === 'enterprise' ? activeBtn : inactiveBtn}
          onClick={() => setMode('enterprise')}
        >
          Enterprise
        </button>
        <button
          type="button"
          className={value.mode === 'entity' ? activeBtn : inactiveBtn}
          onClick={() => setMode('entity')}
          disabled={entities.length === 0}
        >
          Entity
        </button>
        <button
          type="button"
          className={value.mode === 'site' ? activeBtn : inactiveBtn}
          onClick={() => setMode('site')}
          disabled={sites.length === 0}
        >
          Site
        </button>
      </div>

      {value.mode === 'entity' && entities.length > 0 && (
        <select
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
          value={value.entityId ?? ''}
          onChange={(e) => onEntityChange(e.target.value)}
        >
          {entities.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      )}

      {value.mode === 'site' && (
        <>
          {entities.length > 0 && (
            <select
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
              value={value.entityId ?? ''}
              onChange={(e) => onEntityChange(e.target.value)}
            >
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          )}
          {value.entityId ? (
            <select
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
              value={value.siteId ?? ''}
              onChange={(e) => onSiteChange(e.target.value)}
            >
              {filteredSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          ) : (
            <select
              disabled
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-400 cursor-not-allowed"
            >
              <option>Select entity first</option>
            </select>
          )}
        </>
      )}
    </div>
  );
}