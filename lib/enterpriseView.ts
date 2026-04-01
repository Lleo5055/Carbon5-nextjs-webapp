export type ViewMode = 'enterprise' | 'entity' | 'site';

export interface EnterpriseViewState {
  mode: ViewMode;
  orgId?: string;
  entityId?: string;
  siteIds?: string[];  // all site IDs belonging to the selected entity (populated on entity view)
  siteId?: string;
  entityName?: string;
  siteName?: string;
}

export const DEFAULT_VIEW: EnterpriseViewState = { mode: 'enterprise' };

const STORAGE_KEY = 'greenio_enterprise_view';

export function parseViewFromUrl(searchParams: URLSearchParams): EnterpriseViewState {
  const mode = searchParams.get('view') as ViewMode | null;
  if (mode === 'entity') {
    return {
      mode: 'entity',
      entityId: searchParams.get('entityId') ?? undefined,
      entityName: searchParams.get('entityName') ?? undefined,
    };
  }
  if (mode === 'site') {
    return {
      mode: 'site',
      entityId: searchParams.get('entityId') ?? undefined,
      siteId: searchParams.get('siteId') ?? undefined,
      siteName: searchParams.get('siteName') ?? undefined,
    };
  }
  return DEFAULT_VIEW;
}

export function buildViewUrl(base: string, state: EnterpriseViewState): string {
  if (state.mode === 'enterprise') return base;
  const p = new URLSearchParams();
  p.set('view', state.mode);
  if (state.entityId) p.set('entityId', state.entityId);
  if (state.entityName) p.set('entityName', state.entityName);
  if (state.siteId) p.set('siteId', state.siteId);
  if (state.siteName) p.set('siteName', state.siteName);
  return `${base}?${p.toString()}`;
}

export function saveViewState(state: EnterpriseViewState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function loadViewState(): EnterpriseViewState {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? (JSON.parse(s) as EnterpriseViewState) : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

/** Returns filter info that insights pages can apply to their Supabase emissions query. */
export function getInsightsFilter(state: EnterpriseViewState):
  | { type: 'org'; orgId: string }
  | { type: 'sites'; siteIds: string[] }
  | { type: 'site'; siteId: string }
  | null {
  if (state.mode === 'enterprise' && state.orgId) return { type: 'org', orgId: state.orgId };
  if (state.mode === 'entity' && state.siteIds?.length) return { type: 'sites', siteIds: state.siteIds };
  if (state.mode === 'site' && state.siteId) return { type: 'site', siteId: state.siteId };
  return null;
}

export function getViewLabel(state: EnterpriseViewState): string {
  if (state.mode === 'site' && state.siteName) return state.siteName;
  if (state.mode === 'entity' && state.entityName) return state.entityName;
  return 'Enterprise View';
}