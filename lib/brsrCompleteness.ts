// lib/brsrCompleteness.ts
//
// Feature 1.3 — BRSR completeness scoring
//
// Reused by feature 3.2 (BRSR completeness widget on dashboard).
// Takes the brsr_profile row, the account's profiles row, and an
// emission data summary, and returns a score 0–100 plus a list of
// incomplete checks with their link destinations.

export type BrsrCheck = {
  key: string;
  label: string;
  complete: boolean;
  linkTo: string;       // clickable destination in the app
  onlyIfEnabled?: 'water' | 'waste'; // only show if that feature is toggled on
};

export type BrsrCompletenessResult = {
  score: number;          // 0–100
  checks: BrsrCheck[];
  completedCount: number;
  totalCount: number;
};

export type BrsrProfileData = {
  industry_sector?: string | null;
  permanent_employees?: number | null;
  permanent_workers?: number | null;
  is_listed_company?: boolean | null;
  renewable_elec_pct?: number | null;
  has_ghg_reduction_plan?: boolean | null;
};

export type EmissionSummary = {
  hasScope1: boolean;
  hasScope2: boolean;
  hasScope3: boolean;
  hasWater: boolean;
  hasWaste: boolean;
};

export type AccountFeatureFlags = {
  waterEnabled: boolean;
  wasteEnabled: boolean;
};

/**
 * Calculate BRSR completeness score.
 *
 * Checks (8 total, plus conditional water/waste):
 *   1. BRSR profile basic fields (sector + employee counts)
 *   2. Listed company status set
 *   3. Renewable electricity percentage set
 *   4. At least one Scope 1 entry
 *   5. At least one Scope 2 entry
 *   6. At least one Scope 3 entry
 *   7. At least one water entry  (only if water is enabled)
 *   8. At least one waste entry  (only if waste is enabled)
 *
 * Score = completed / total * 100
 */
export function computeBrsrCompleteness(
  profile: BrsrProfileData | null,
  emissions: EmissionSummary,
  flags: AccountFeatureFlags
): BrsrCompletenessResult {
  const checks: BrsrCheck[] = [
    {
      key: 'brsr_basic_fields',
      label: 'BRSR profile — sector and employee counts',
      complete: !!(
        profile?.industry_sector &&
        profile?.permanent_employees != null &&
        profile?.permanent_workers != null
      ),
      linkTo: '/dashboard/brsr-profile',
    },
    {
      key: 'listed_status',
      label: 'Listed company status set',
      complete: profile?.is_listed_company != null,
      linkTo: '/dashboard/brsr-profile',
    },
    {
      key: 'renewable_pct',
      label: 'Renewable electricity percentage set',
      complete: profile?.renewable_elec_pct != null,
      linkTo: '/dashboard/brsr-profile',
    },
    {
      key: 'scope1',
      label: 'At least one Scope 1 entry',
      complete: emissions.hasScope1,
      linkTo: '/dashboard/emissions',
    },
    {
      key: 'scope2',
      label: 'At least one Scope 2 entry',
      complete: emissions.hasScope2,
      linkTo: '/dashboard/emissions',
    },
    {
      key: 'scope3',
      label: 'At least one Scope 3 entry',
      complete: emissions.hasScope3,
      linkTo: '/dashboard/emissions/scope3/add',
    },
  ];

  if (flags.waterEnabled) {
    checks.push({
      key: 'water',
      label: 'At least one water entry',
      complete: emissions.hasWater,
      linkTo: '/dashboard/emissions/water',
      onlyIfEnabled: 'water',
    });
  }

  if (flags.wasteEnabled) {
    checks.push({
      key: 'waste',
      label: 'At least one waste entry',
      complete: emissions.hasWaste,
      linkTo: '/dashboard/emissions/waste',
      onlyIfEnabled: 'waste',
    });
  }

  const completedCount = checks.filter((c) => c.complete).length;
  const totalCount = checks.length;
  const score = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return { score, checks, completedCount, totalCount };
}
