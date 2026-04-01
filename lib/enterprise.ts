// lib/enterprise.ts
//
// Multi-entity / multi-site management for enterprise users.
// Types and helpers for organisations, entities, sites, and members.

import { supabase } from '@/lib/supabaseClient';

// ─── Role & Status enums ───────────────────────────────────────────────────────

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';

export type OrgMemberStatus = 'pending' | 'active' | 'suspended';

// ─── Core types ────────────────────────────────────────────────────────────────

export type Organisation = {
  id: string;
  name: string;
  created_at: string;
  created_by: string;
};

export type Entity = {
  id: string;
  org_id: string;
  name: string;
  country_code: string;
  currency: string | null;
  locale: string | null;
  fy_start_month: number | null;
  secr_required: boolean | null;
  csrd_required: boolean | null;
  brsr_required: boolean | null;
  industry: string | null;
  company_size: string | null;
  annual_revenue: number | null;
  employee_count: number | null;
  created_at: string;
};

export type Site = {
  id: string;
  entity_id: string;
  org_id: string;
  name: string;
  address: string | null;
  city: string | null;
  postcode: string | null;
  country_code: string | null;
  is_primary: boolean;
  created_at: string;
};

export type OrgMember = {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  entity_access: string[] | null;
  invited_at: string | null;
  joined_at: string | null;
  status: OrgMemberStatus;
};

export type OrgWithHierarchy = Organisation & {
  entities: (Entity & { sites: Site[] })[];
  members: OrgMember[];
};

// ─── Helper functions ──────────────────────────────────────────────────────────

/**
 * Create a new organisation and automatically add the creator as owner.
 */
export async function createOrganisation(
  name: string,
  userId: string
): Promise<Organisation> {
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .insert({ name, created_by: userId })
    .select()
    .single();

  if (orgError || !org) {
    throw new Error(`Failed to create organisation: ${orgError?.message}`);
  }

  const { error: memberError } = await supabase
    .from('org_members')
    .insert({
      org_id: org.id,
      user_id: userId,
      role: 'owner' as OrgRole,
      status: 'active' as OrgMemberStatus,
      joined_at: new Date().toISOString(),
      invited_at: null,
      entity_access: null,
    });

  if (memberError) {
    throw new Error(`Failed to add owner member: ${memberError.message}`);
  }

  return org as Organisation;
}

/**
 * Create a new entity within an organisation.
 */
export async function createEntity(
  orgId: string,
  data: Omit<Entity, 'id' | 'org_id' | 'created_at'>
): Promise<Entity> {
  const { data: entity, error } = await supabase
    .from('entities')
    .insert({ ...data, org_id: orgId })
    .select()
    .single();

  if (error || !entity) {
    throw new Error(`Failed to create entity: ${error?.message}`);
  }

  return entity as Entity;
}

/**
 * Create a new site under an entity.
 */
export async function createSite(
  entityId: string,
  orgId: string,
  data: Omit<Site, 'id' | 'entity_id' | 'org_id' | 'created_at'>
): Promise<Site> {
  const { data: site, error } = await supabase
    .from('sites')
    .insert({ ...data, entity_id: entityId, org_id: orgId })
    .select()
    .single();

  if (error || !site) {
    throw new Error(`Failed to create site: ${error?.message}`);
  }

  return site as Site;
}

/**
 * Fetch an organisation with its full entity → site hierarchy and member list.
 */
export async function getOrgWithHierarchy(
  orgId: string
): Promise<OrgWithHierarchy | null> {
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (orgError) {
    throw new Error(`Failed to fetch organisation: ${orgError.message}`);
  }
  if (!org) return null;

  const { data: entities, error: entitiesError } = await supabase
    .from('entities')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (entitiesError) {
    throw new Error(`Failed to fetch entities: ${entitiesError.message}`);
  }

  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (sitesError) {
    throw new Error(`Failed to fetch sites: ${sitesError.message}`);
  }

  const { data: members, error: membersError } = await supabase
    .from('org_members')
    .select('*')
    .eq('org_id', orgId);

  if (membersError) {
    throw new Error(`Failed to fetch members: ${membersError.message}`);
  }

  const sitesByEntity = ((sites ?? []) as Site[]).reduce<Record<string, Site[]>>(
    (acc, site) => {
      if (!acc[site.entity_id]) acc[site.entity_id] = [];
      acc[site.entity_id].push(site);
      return acc;
    },
    {}
  );

  const entitiesWithSites = ((entities ?? []) as Entity[]).map((entity) => ({
    ...entity,
    sites: sitesByEntity[entity.id] ?? [],
  }));

  return {
    ...(org as Organisation),
    entities: entitiesWithSites,
    members: (members ?? []) as OrgMember[],
  };
}

/**
 * Fetch all organisations a user is an active member of.
 */
export async function getUserOrgs(userId: string): Promise<Organisation[]> {
  const { data: memberships, error: memberError } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (memberError) {
    throw new Error(`Failed to fetch user memberships: ${memberError.message}`);
  }

  if (!memberships || memberships.length === 0) return [];

  const orgIds = memberships.map((m: { org_id: string }) => m.org_id);

  const { data: orgs, error: orgsError } = await supabase
    .from('organisations')
    .select('*')
    .in('id', orgIds)
    .order('created_at', { ascending: true });

  if (orgsError) {
    throw new Error(`Failed to fetch organisations: ${orgsError.message}`);
  }

  return (orgs ?? []) as Organisation[];
}

/**
 * Check whether a user is on the enterprise plan.
 */
export async function isEnterpriseUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_plans')
    .select('plan')
    .eq('user_id', userId)
    .single();

  if (error || !data) return false;

  return data.plan === 'enterprise';
}