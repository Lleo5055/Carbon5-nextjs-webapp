'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { calcRefrigerantCo2e } from '../../../lib/emissionFactors';
import { getFactorsForCountry } from '@/lib/factors';
import { logActivity } from '../../../lib/logActivity';
import { isEnterpriseUser, getUserOrgs, getOrgWithHierarchy, type Site } from '@/lib/enterprise';
import { Suspense } from 'react';
// --------------------------------
// FIX 1: Safe default Scope 3 key
// --------------------------------
const DEFAULT_SCOPE3 = 'business_travel';

type TallyLedger = {
  tally_name: string;
  total_debit: number;
  entry_count: number;
  match_status: 'auto_matched' | 'suggested' | 'needs_mapping' | 'skipped';
  suggested_source: string | null;
  confirmed_source: string | null;
  quantity: number | null;
  quantity_unit: string | null;
  flag: 'new_ledger' | 'combined_entries' | 'quantity_needed' | null;
  flag_message: string | null;
};

type TallyParseResponse = {
  status: 'ok' | 'wrong_report' | 'empty' | 'error';
  month_detected: string | null;
  ledgers: TallyLedger[];
  error_message: string | null;
  guide_link: string | null;
};
const INDIA_FLAGS_CACHE_KEY = 'greenio_india_flags_v1';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function buildMonthLabel(monthName: string, year: number) {
  return `${monthName} ${year}`;
}

function parseMonthLabel(label: string | null | undefined) {
  if (!label || typeof label !== 'string') {
    const now = new Date();
    return {
      monthName: MONTHS[now.getMonth()],
      year: now.getFullYear(),
    };
  }

  const parts = label.split(' ');
  if (parts.length >= 2) {
    const maybeYear = Number(parts[parts.length - 1]);
    const monthName = parts.slice(0, parts.length - 1).join(' ');
    if (!Number.isNaN(maybeYear) && MONTHS.includes(monthName)) {
      return { monthName, year: maybeYear };
    }
  }

  const now = new Date();
  return {
    monthName: MONTHS[now.getMonth()],
    year: now.getFullYear(),
  };
}

const REFRIGERANT_OPTIONS = [
  { value: 'R410A', label: 'R410A (split AC – common)' },
  { value: 'R134A', label: 'R134a (chillers / older systems)' },
  { value: 'R407C', label: 'R407C (comfort cooling)' },
  { value: 'R404A', label: 'R404A (cold rooms / refrigeration)' },
  { value: 'GENERIC_HFC', label: 'Not sure / generic HFC' },
];

// --------------------------------
// SCOPE 3 categories & factors
// --------------------------------
const SCOPE3_CATEGORIES = [
  { value: 'purchased_goods', label: 'Purchased goods & services' },
  { value: 'business_travel', label: 'Business travel' },
  { value: 'employee_commuting', label: 'Employee commuting' },
  { value: 'waste', label: 'Waste generated in operations' },
  { value: 'upstream_transport', label: 'Upstream transport & distribution' },
  { value: 'downstream_transport', label: 'Downstream transport & use' },
  { value: 'other', label: 'Other Scope 3' },
];

// (unchanged factors)
const SCOPE3_FACTOR_CONFIG: Record<
  string,
  {
    unitLabel: string;
    inputLabel: string;
    helper: string;
    factorKgPerUnit: number;
  }
> = {
  purchased_goods: {
    unitLabel: '£ spend',
    inputLabel: 'Spend this month (£)',
    helper:
      'Total spend on goods & services that are mainly purchased for operations (ex-VAT where possible).',
    factorKgPerUnit: 0.35,
  },
  business_travel: {
    unitLabel: 'km travelled',
    inputLabel: 'Business travel distance (km)',
    helper:
      'Approximate total distance for business travel (flights, trains, taxis, etc.) this month.',
    factorKgPerUnit: 0.18,
  },
  employee_commuting: {
    unitLabel: 'km commuted',
    inputLabel: 'Employee commuting distance (km)',
    helper:
      'Rough total commute distance for staff this month (all modes combined).',
    factorKgPerUnit: 0.12,
  },
  waste: {
    unitLabel: 'kg waste',
    inputLabel: 'Waste generated (kg)',
    helper:
      'Mixed operational waste sent to landfill / energy-from-waste / recycling this month.',
    factorKgPerUnit: 0.5,
  },
  upstream_transport: {
    unitLabel: 'tonne·km',
    inputLabel: 'Upstream transport (tonne·km)',
    helper:
      'Freight for inbound goods – tonnes moved × distance in km (rough estimate is fine).',
    factorKgPerUnit: 0.12,
  },
  downstream_transport: {
    unitLabel: 'tonne·km',
    inputLabel: 'Downstream transport (tonne·km)',
    helper:
      'Freight for delivering products/services to customers – tonnes moved × distance.',
    factorKgPerUnit: 0.12,
  },
  other: {
    unitLabel: 'kg CO₂e',
    inputLabel: 'Known Scope 3 CO₂e (kg)',
    helper:
      'If you already have a CO₂e figure from another tool, enter it directly here.',
    factorKgPerUnit: 1,
  },
};

function EmissionsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ✅ Edit support
  const edit = searchParams.get('edit');
  const editingId = searchParams.get('id');
  // scope3 edit: ?edit=scope3&id=<scope3_activities.id>
  const isScope3EditMode = edit === 'scope3' && Boolean(editingId);
  // scope1/2 edit: ?id=<emissions.id> (no edit param) — used by RowActions Edit button
  const isScope1EditMode = Boolean(editingId) && edit !== 'scope3';
  // any edit mode — for UI (heading, button text, note)
  const isEditMode = Boolean(editingId);
  // Section C edit params — ?sectionc=water|waste|air&sectionc_id=<id>&sectionc_label=<label>
  const sectioncTable = searchParams.get('sectionc') as 'water_entries' | 'waste_entries' | 'air_emissions' | null;
  const sectioncId = searchParams.get('sectionc_id');
  const sectioncLabel = searchParams.get('sectionc_label');

  const today = new Date();
  const currentYear = today.getFullYear();

  const [monthName, setMonthName] = useState<string>(MONTHS[today.getMonth()]);
  const [year, setYear] = useState<number>(currentYear);

  const [electricityKwh, setElectricityKwh] = useState<string>('');
  const [dieselLitres, setDieselLitres] = useState<string>('');
  const [petrolLitres, setPetrolLitres] = useState<string>('');
  const [gasKwh, setGasKwh] = useState<string>('');
  const [lpgKg, setLpgKg] = useState<string>('');
  const [cngKg, setCngKg] = useState<string>('');
  const [refrigerantKg, setRefrigerantKg] = useState<string>('');
  const [refrigerantCode, setRefrigerantCode] =
    useState<string>('GENERIC_HFC');
  const [productOutput, setProductOutput] = useState<string>('');
  const [productUnit, setProductUnit] = useState<string>('tonnes');

  // --------------------------------
  // Bill scan state
  // --------------------------------
  type EntryMode = 'manual' | 'scan' | 'tally' | 'bulk';
  const [entryMode, setEntryMode] = useState<EntryMode>('manual');

  const [tallyFile, setTallyFile] = useState<File | null>(null);
  const [tallyParsing, setTallyParsing] = useState(false);
  const [tallyError, setTallyError] = useState<string | null>(null);
  const [tallyResult, setTallyResult] = useState<TallyParseResponse | null>(null);
  const [tallyMappings, setTallyMappings] = useState<Record<string, string>>({});
  const [tallyQuantities, setTallyQuantities] = useState<Record<string, string>>({});
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<{
    status: string;
    total_rows: number;
    valid_count: number;
    skipped_count: number;
    rows: any[];
    skipped_rows: any[];
  } | null>(null);
  const [bulkSaveResult, setBulkSaveResult] = useState<{
    saved: number;
    updated: number;
    errors: string[];
  } | null>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billDocType, setBillDocType] = useState<'electricity' | 'diesel' | 'petrol' | 'gas' | 'refrigerant'>('electricity');
  const [billScanning, setBillScanning] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);
  const [billSuggestion, setBillSuggestion] = useState<null | {
    month: string;
    electricity_kwh: number;
    fuel_litres: number;
    gas_kwh: number;
    refrigerant_kg: number;
    refrigerant_type: string;
  }>(null);

  // --------------------------------
  // Scope 3 FIXED: guaranteed default
  // --------------------------------
  const [scope3Enabled, setScope3Enabled] = useState<boolean>(false);
  const [scope3Category, setScope3Category] = useState<string>(DEFAULT_SCOPE3);
  const [scope3Label, setScope3Label] = useState<string>('');
  const [scope3ActivityValue, setScope3ActivityValue] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // India-specific feature flags
  const [isIndia, setIsIndia] = useState(false);
  const [indiaWaterEnabled, setIndiaWaterEnabled] = useState(false);
  const [indiaWasteEnabled, setIndiaWasteEnabled] = useState(false);
  const [indiaAirEnabled, setIndiaAirEnabled] = useState(false);

  // Water form state
  const [waterOpen, setWaterOpen] = useState(false);
  const [waterSourceType, setWaterSourceType] = useState('municipal');
  const [waterWithdrawnKl, setWaterWithdrawnKl] = useState('');
  const [waterConsumedKl, setWaterConsumedKl] = useState('');
  const [waterDischargedKl, setWaterDischargedKl] = useState('');
  const [waterDischargeDestination, setWaterDischargeDestination] = useState('');

  // Waste form state
  const [wasteOpen, setWasteOpen] = useState(false);
  const [wasteTotalKg, setWasteTotalKg] = useState('');
  const [wasteLandfillKg, setWasteLandfillKg] = useState('');
  const [wasteRecycledKg, setWasteRecycledKg] = useState('');
  const [wasteIncineratedKg, setWasteIncineratedKg] = useState('');
  const [wasteHazardousKg, setWasteHazardousKg] = useState('');

  // Air form state (annual FY)
  const [airOpen, setAirOpen] = useState(false);
  const [airFY, setAirFY] = useState<number>(() => {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  });
  const [airNox, setAirNox] = useState('');
  const [airSox, setAirSox] = useState('');
  const [airPm, setAirPm] = useState('');
  const [airOtherName, setAirOtherName] = useState('');
  const [airOtherTonnes, setAirOtherTonnes] = useState('');
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [availableSites, setAvailableSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [orgRole, setOrgRole] = useState<string | null>(null); // null = SME or not yet loaded
  const [enterpriseLoading, setEnterpriseLoading] = useState(true);
  // -------------------------------
  // Load existing row when editing
  // -------------------------------
  useEffect(() => {
    if (!editingId) return;

    let cancelled = false;

    async function loadForEdit() {
      try {
        const { data, error } = await supabase
          .from('emissions')
          .select('*')
          .eq('id', editingId)
          .maybeSingle();

        if (error) {
          console.error('Error loading emission for edit', error);
          return;
        }
        if (!data || cancelled) return;

        const parsed = parseMonthLabel(data.month as string | null);
        setMonthName(parsed.monthName);
        setYear(parsed.year);

        setElectricityKwh(
          data.electricity_kw != null ? String(data.electricity_kw) : ''
        );
        setDieselLitres(
          data.diesel_litres != null ? String(data.diesel_litres) : ''
        );
        setPetrolLitres(
          data.petrol_litres != null ? String(data.petrol_litres) : ''
        );
        setGasKwh(data.gas_kwh != null ? String(data.gas_kwh) : '');
        setLpgKg(data.lpg_kg != null ? String(data.lpg_kg) : '');
        setCngKg(data.cng_kg != null ? String(data.cng_kg) : '');
        setRefrigerantKg(
          data.refrigerant_kg != null ? String(data.refrigerant_kg) : ''
        );

        const code =
          (data.refrigerant_code as string | null) ??
          (data.refrigerant_type as string | null) ??
          'GENERIC_HFC';

        setRefrigerantCode(code);
        // Load product output from production_entries, not emissions
        const mk = data.month_key;
        if (mk) {
          const { data: { user: editUser } } = await supabase.auth.getUser();
          if (editUser) {
            const { data: prodEntry } = await supabase
              .from('production_entries')
              .select('quantity, unit')
              .eq('user_id', editUser.id)
              .eq('month_key', mk)
              .maybeSingle();
            if (prodEntry) {
              setProductOutput(String(prodEntry.quantity));
              setProductUnit(prodEntry.unit ?? 'tonnes');
            }
          }
        }
      } catch (err) {
        console.error('Unexpected error loading emission for edit', err);
      }
    }

    loadForEdit();
    return () => {
      cancelled = true;
    };
  }, [editingId]);
// --------------------------------
// Load existing Scope 3 row when editing
// --------------------------------
useEffect(() => {
  if (!isScope3EditMode || !editingId) return;

  supabase
    .from('scope3_activities')
    .select('*')
    .eq('id', editingId)
    .single()
    .then(({ data }) => {
      if (!data) return;

      const parsed = parseMonthLabel(data.month as string | null);
      setMonthName(parsed.monthName);
      setYear(parsed.year);

      setScope3Enabled(true);
      setScope3Category(data.category ?? DEFAULT_SCOPE3);
      setScope3Label(data.label ?? '');
      setScope3ActivityValue(
        data.data?.activity_value != null ? String(data.data.activity_value) : ''
      );
    });
}, [isScope3EditMode, editingId]); // ✅ correct

// Load Section C entry (water/waste/air) for editing
useEffect(() => {
  if (!sectioncTable || !sectioncId) return;

  async function loadSectionC() {
    const { data } = await (supabase as any)
      .from(sectioncTable)
      .select('*')
      .eq('id', sectioncId)
      .maybeSingle();

    if (!data) return;

    if (sectioncTable === 'water_entries') {
      // period_month is 1-indexed
      const mn = MONTHS[(data.period_month ?? 1) - 1];
      if (mn) setMonthName(mn);
      if (data.period_year) setYear(data.period_year);
      setWaterSourceType(data.source_type ?? 'municipal');
      setWaterWithdrawnKl(data.volume_withdrawn_kl != null ? String(data.volume_withdrawn_kl) : '');
      setWaterConsumedKl(data.volume_consumed_kl != null ? String(data.volume_consumed_kl) : '');
      setWaterDischargedKl(data.volume_discharged_kl != null ? String(data.volume_discharged_kl) : '');
      setWaterDischargeDestination(data.discharge_destination ?? '');
      setWaterOpen(true);
    } else if (sectioncTable === 'waste_entries') {
      const mn = MONTHS[(data.period_month ?? 1) - 1];
      if (mn) setMonthName(mn);
      if (data.period_year) setYear(data.period_year);
      setWasteTotalKg(data.total_kg != null ? String(data.total_kg) : '');
      setWasteLandfillKg(data.landfill_kg != null ? String(data.landfill_kg) : '');
      setWasteRecycledKg(data.recycled_kg != null ? String(data.recycled_kg) : '');
      setWasteIncineratedKg(data.incinerated_kg != null ? String(data.incinerated_kg) : '');
      setWasteHazardousKg(data.hazardous_kg != null ? String(data.hazardous_kg) : '');
      setWasteOpen(true);
    } else if (sectioncTable === 'air_emissions') {
      if (data.period_year) setAirFY(data.period_year);
      setAirNox(data.nox_tonnes != null ? String(data.nox_tonnes) : '');
      setAirSox(data.sox_tonnes != null ? String(data.sox_tonnes) : '');
      setAirPm(data.pm_tonnes != null ? String(data.pm_tonnes) : '');
      setAirOtherName(data.other_pollutant_name ?? '');
      setAirOtherTonnes(data.other_pollutant_tonnes != null ? String(data.other_pollutant_tonnes) : '');
      setAirOpen(true);
    }
  }

  loadSectionC();
}, [sectioncTable, sectioncId]);

// Load India feature flags — instant from cache, then refresh from DB
useEffect(() => {
  // Paint immediately from sessionStorage cache
  try {
    const cached = sessionStorage.getItem(INDIA_FLAGS_CACHE_KEY);
    if (cached) {
      const flags = JSON.parse(cached);
      if (flags.isIndia) {
        setIsIndia(true);
        setIndiaWaterEnabled(!!flags.waterEnabled);
        setIndiaWasteEnabled(!!flags.wasteEnabled);
        setIndiaAirEnabled(!!flags.airEnabled);
      }
    }
  } catch {}

  // Refresh from DB in background (getSession reads localStorage — no network round-trip)
  supabase.auth.getSession().then(({ data: { session } }) => {
    const user = session?.user;
    if (!user) return;
    supabase
      .from('profiles')
      .select('country, india_water_enabled, india_waste_enabled, india_air_enabled')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const india = data?.country === 'IN';
        try {
          sessionStorage.setItem(INDIA_FLAGS_CACHE_KEY, JSON.stringify({
            isIndia: india,
            waterEnabled: !!data?.india_water_enabled,
            wasteEnabled: !!data?.india_waste_enabled,
            airEnabled:   !!data?.india_air_enabled,
          }));
        } catch {}
        if (india) {
          setIsIndia(true);
          setIndiaWaterEnabled(!!data!.india_water_enabled);
          setIndiaWasteEnabled(!!data!.india_waste_enabled);
          setIndiaAirEnabled(!!data!.india_air_enabled);
        }
      });
  });
}, []);

// Load enterprise sites on mount
useEffect(() => {
  async function loadEnterprise() {
    setEnterpriseLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const enterprise = await isEnterpriseUser(user.id);
      setIsEnterprise(enterprise);
      if (enterprise) {
        const orgs = await getUserOrgs(user.id);
        if (orgs.length > 0) {
          const orgData = await getOrgWithHierarchy(orgs[0].id);
          if (orgData) {
            const allSites = orgData.entities.flatMap(e => e.sites);
            setAvailableSites(allSites);
            const primary = allSites.find(s => s.is_primary);
            setSelectedSiteId(primary?.id ?? allSites[0]?.id ?? null);

            // Fetch current user's role in this org
            try {
              const res = await fetch(`/api/org/members?org_id=${orgs[0].id}`);
              if (res.ok) {
                const allMembers = await res.json();
                const myMember = allMembers.find((m: any) => m.user_id === user.id);
                if (myMember) setOrgRole(myMember.role);
              }
            } catch {
              // Non-fatal — default to full access on error
            }
          }
        }
      }
    } finally {
      setEnterpriseLoading(false);
    }
  }
  loadEnterprise();
}, []);

  // -------------------------------------------
  // FIX 2: Safe Scope 3 config + calc block
  // -------------------------------------------
  const activeScope3Config =
    SCOPE3_FACTOR_CONFIG[scope3Category] ??
    SCOPE3_FACTOR_CONFIG[DEFAULT_SCOPE3];

  const parsedActivity = Number(scope3ActivityValue) || 0;

  const calculatedScope3Kg =
    scope3Enabled && parsedActivity > 0
      ? parsedActivity * activeScope3Config.factorKgPerUnit
      : 0;

  // -------------------------------------------
  // BILL SCAN
  // -------------------------------------------
  async function handleBillScan() {
    if (!billFile) return;
    setBillScanning(true);
    setBillError(null);
    setBillSuggestion(null);
    const fd = new FormData();
    fd.append('file', billFile);
    fd.append('docType', billDocType);
    fd.append('monthHint', buildMonthLabel(monthName, year));
    const res = await fetch('/api/parse-invoice', { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok || !json.suggestion) {
      setBillError(json.error ?? 'Could not read bill. Try a clearer image.');
    } else {
      setBillSuggestion(json.suggestion);
    }
    setBillScanning(false);
  }

  function applyBillSuggestion() {
    if (!billSuggestion) return;
    const parsed = parseMonthLabel(billSuggestion.month);
    setMonthName(parsed.monthName);
    setYear(parsed.year);
    if (billSuggestion.electricity_kwh > 0) setElectricityKwh(String(billSuggestion.electricity_kwh));
    if (billSuggestion.fuel_litres > 0) {
      if (billDocType === 'diesel') setDieselLitres(String(billSuggestion.fuel_litres));
      if (billDocType === 'petrol') setPetrolLitres(String(billSuggestion.fuel_litres));
    }
    if (billSuggestion.gas_kwh > 0) setGasKwh(String(billSuggestion.gas_kwh));
    if (billSuggestion.refrigerant_kg > 0) setRefrigerantKg(String(billSuggestion.refrigerant_kg));
    if (billSuggestion.refrigerant_type) setRefrigerantCode(billSuggestion.refrigerant_type);
    setEntryMode('manual');
    setBillSuggestion(null);
    setBillFile(null);
  }

  async function handleTallyParse() {
    if (!tallyFile) return;
    setTallyParsing(true);
    setTallyError(null);
    setTallyResult(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setTallyParsing(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';

    const fd = new FormData();
    fd.append('file', tallyFile);
    fd.append('userId', user.id);
    fd.append('token', token);
    fd.append('monthHint', buildMonthLabel(monthName, year));

    try {
      const res = await fetch('/api/tally/parse', { method: 'POST', body: fd });
      const json: TallyParseResponse = await res.json();
      setTallyParsing(false);

      if (json.status === 'wrong_report') { setTallyError('wrong_report'); return; }
      if (json.status === 'empty') { setTallyError('empty'); return; }
      if (json.status === 'error') { setTallyError('parse_error'); return; }

      const initialMappings: Record<string, string> = {};
      for (const ledger of json.ledgers) {
        if (ledger.match_status === 'skipped') {
          initialMappings[ledger.tally_name] = 'skip';
        } else if (ledger.confirmed_source) {
          initialMappings[ledger.tally_name] = ledger.confirmed_source;
        } else if (ledger.suggested_source) {
          initialMappings[ledger.tally_name] = ledger.suggested_source;
        } else if (ledger.match_status === 'needs_mapping') {
          // Leave blank — user must map manually
          initialMappings[ledger.tally_name] = '';
        }
      }

      const NON_EMISSION_KEYWORDS = [
        'salary', 'rent', 'office', 'telephone', 'professional', 'travelling',
        'travel', 'stationery', 'printing', 'postage', 'insurance', 'legal',
        'audit', 'accounting', 'bank charges', 'interest', 'depreciation',
        'subscription', 'software', 'internet', 'broadband', 'cleaning',
        'security', 'canteen', 'food', 'entertainment', 'repair', 'maintenance',
        'advertisement', 'marketing', 'courier', 'freight charges',
      ];

      for (const ledger of json.ledgers) {
        if (initialMappings[ledger.tally_name]) continue;
        const lower = ledger.tally_name.toLowerCase();
        const isObviouslyNonEmission = NON_EMISSION_KEYWORDS.some(kw => lower.includes(kw));
        if (isObviouslyNonEmission) {
          initialMappings[ledger.tally_name] = 'skip';
        }
      }

      setTallyMappings(initialMappings);
      setTallyResult(json);
    } catch {
      setTallyParsing(false);
      setTallyError('parse_error');
    }
  }

  async function handleTallyApply() {
    if (!tallyResult) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';

    const mappingsToSave = tallyResult.ledgers.map(l => ({
      tally_ledger_name: l.tally_name,
      emission_source: tallyMappings[l.tally_name] === 'skip' ? null : (tallyMappings[l.tally_name] ?? null),
      skip: tallyMappings[l.tally_name] === 'skip',
    }));

    await fetch('/api/tally/save-mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, token, mappings: mappingsToSave }),
    });

    for (const ledger of tallyResult.ledgers) {
      const source = tallyMappings[ledger.tally_name];
      const qty = tallyQuantities[ledger.tally_name];
      if (!source || source === 'skip' || !qty || Number(qty) <= 0) continue;
      if (source === 'electricity') setElectricityKwh(qty);
      if (source === 'diesel') setDieselLitres(qty);
      if (source === 'petrol') setPetrolLitres(qty);
      if (source === 'lpg') setLpgKg(qty);
      if (source === 'cng') setCngKg(qty);
      if (source === 'gas') setGasKwh(qty);
      if (source === 'refrigerant') setRefrigerantKg(qty);
    }

    // Log tally import applied
    const appliedSources = tallyResult.ledgers
      .map(l => tallyMappings[l.tally_name])
      .filter(s => s && s !== 'skip');
    logActivity('tally_import', 'emission', {
      month: `${monthName} ${year}`,
      sources: appliedSources.filter((s, i, a) => a.indexOf(s) === i),
    });

    setEntryMode('manual');
    setTallyResult(null);
    setTallyFile(null);
    setTallyMappings({});
    setTallyQuantities({});
  }

  async function handleBulkParse() {
    if (!bulkFile) return;
    setBulkParsing(true);
    setBulkError(null);
    setBulkResult(null);
    setBulkSaveResult(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBulkParsing(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';

    const fd = new FormData();
    fd.append('file', bulkFile);
    fd.append('userId', user.id);
    fd.append('token', token);

    try {
      const res = await fetch('/api/bulk-upload/parse', { method: 'POST', body: fd });
      const json = await res.json();
      setBulkParsing(false);

      if (json.status === 'wrong_template') { setBulkError(json.error); return; }
      if (json.status === 'empty') { setBulkError(json.error); return; }
      if (json.status === 'error') { setBulkError(json.error || 'Failed to parse file.'); return; }

      setBulkResult(json);
    } catch {
      setBulkParsing(false);
      setBulkError('Failed to read file. Please try again.');
    }
  }

  async function handleBulkSave() {
    if (!bulkResult) return;
    setBulkSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBulkSaving(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';

    try {
      const res = await fetch('/api/bulk-upload/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, token, rows: bulkResult.rows }),
      });
      const json = await res.json();
      setBulkSaving(false);
      setBulkSaveResult(json);
      setBulkResult(null);
      setBulkFile(null);
    } catch {
      setBulkSaving(false);
      setBulkError('Failed to save data. Please try again.');
    }
  }

  // -------------------------------------------
  // FORM SUBMIT
  // -------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    console.log('handleSubmit fired', { isIndia, productOutput, productUnit, monthName, year, electricityKwh, dieselLitres, petrolLitres, gasKwh, lpgKg, cngKg, refrigerantKg });
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const monthLabel = buildMonthLabel(monthName, year);

    const elec = Number(electricityKwh) || 0;
    const diesel = Number(dieselLitres) || 0;
    const petrol = Number(petrolLitres) || 0;
    const gas = Number(gasKwh) || 0;
    const lpg = Number(lpgKg) || 0;
    const cng = Number(cngKg) || 0;
    const ref = Number(refrigerantKg) || 0;
    const refCode = refrigerantCode || 'GENERIC_HFC';
    let hasRealScope12 = elec !== 0 || diesel !== 0 || petrol !== 0 || gas !== 0 || lpg !== 0 || cng !== 0 || ref !== 0;

    const hasScope12Activity =
      elec !== 0 || diesel !== 0 || petrol !== 0 || gas !== 0 ||
      lpg !== 0 || cng !== 0 || ref !== 0 ||
      (isIndia && Number(productOutput) > 0);

    const hasScope3Activity = scope3Enabled && calculatedScope3Kg > 0;

    // ensure logged in
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError('You must be signed in to save emissions.');
      setLoading(false);
      return;
    }

    // Load country-aware factors from user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('country')
      .eq('id', user.id)
      .single();
    const ef = getFactorsForCountry(profile?.country ?? 'GB');

// ----------------------------------
// BLOCK SAVE IF MONTH IS LOCKED
// Only blocks Scope 1/2 emission changes — not production output or Scope 3
// ----------------------------------
const { data: lock } = await supabase
  .from('report_locks')
  .select('locked')
  .eq('user_id', user.id)
  .eq('month', monthLabel)
  .maybeSingle();

const monthIsLocked = !!lock?.locked;

// Only block if saving actual emission sources (not just production output or scope 3)
const savingEmissions = (
  (Number(electricityKwh) || 0) !== 0 ||
  (Number(dieselLitres) || 0) !== 0 ||
  (Number(petrolLitres) || 0) !== 0 ||
  (Number(gasKwh) || 0) !== 0 ||
  (Number(lpgKg) || 0) !== 0 ||
  (Number(cngKg) || 0) !== 0 ||
  (Number(refrigerantKg) || 0) !== 0
);

if (monthIsLocked && savingEmissions) {
  setError('This month is locked. Unlock it to make changes to emission data.');
  setLoading(false);
  return;
}

    const fuelCo2 =
      diesel * ef.diesel +
      petrol * ef.petrol +
      gas * ef.gas +
      lpg * ef.lpgKg +
      cng * ef.cngKg;

    const elecCo2 = elec * ef.electricity;
    const refCo2 = calcRefrigerantCo2e(ref, refCode);
    const totalCo2e = elecCo2 + fuelCo2 + refCo2;

    try {
      let scope12MessagePart = '';
      let scope3MessagePart = '';

      // ----------------------------------
      // SCOPE 1 & 2 — unchanged logic
      // ----------------------------------
      if (hasScope12Activity) {
        const { data: existingRows } = await supabase
          .from('emissions')
          .select('*')
          .eq('month', monthLabel);

        const existing = existingRows?.[0];

        if (existing) {

          // SCOPE1 EDIT MODE → REPLACE VALUES, DO NOT ACCUMULATE
          const updatedElectricity = isScope1EditMode
  ? elec
  : (existing.electricity_kw ?? 0) + elec;

const updatedDiesel = isScope1EditMode
  ? diesel
  : (existing.diesel_litres ?? 0) + diesel;

const updatedPetrol = isScope1EditMode
  ? petrol
  : (existing.petrol_litres ?? 0) + petrol;

const updatedGas = isScope1EditMode
  ? gas
  : (existing.gas_kwh ?? 0) + gas;

const updatedLpg = isScope1EditMode
  ? lpg
  : (existing.lpg_kg ?? 0) + lpg;

const updatedCng = isScope1EditMode
  ? cng
  : (existing.cng_kg ?? 0) + cng;

const updatedRefrigerant = isScope1EditMode
  ? ref
  : (existing.refrigerant_kg ?? 0) + ref;

const updatedFuelCo2 =
  updatedDiesel * ef.diesel +
  updatedPetrol * ef.petrol +
  updatedGas * ef.gas +
  updatedLpg * ef.lpgKg +
  updatedCng * ef.cngKg;

const updatedElecCo2 = updatedElectricity * ef.electricity;

const updatedRefCo2 = calcRefrigerantCo2e(
  updatedRefrigerant,
  refCode
);

const updatedTotalCo2e =
  updatedElecCo2 + updatedFuelCo2 + updatedRefCo2;

          const updatedCalcBreakdown = {
            electricity: updatedElectricity > 0 ? { qty: updatedElectricity, unit: 'kWh', ef: ef.electricity, co2e_kg: updatedElecCo2 } : null,
            diesel: updatedDiesel > 0 ? { qty: updatedDiesel, unit: 'L', ef: ef.diesel, co2e_kg: updatedDiesel * ef.diesel } : null,
            petrol: updatedPetrol > 0 ? { qty: updatedPetrol, unit: 'L', ef: ef.petrol, co2e_kg: updatedPetrol * ef.petrol } : null,
            gas: updatedGas > 0 ? { qty: updatedGas, unit: 'kWh', ef: ef.gas, co2e_kg: updatedGas * ef.gas } : null,
            lpg: updatedLpg > 0 ? { qty: updatedLpg, unit: 'kg', ef: ef.lpgKg, co2e_kg: updatedLpg * ef.lpgKg } : null,
            cng: updatedCng > 0 ? { qty: updatedCng, unit: 'kg', ef: ef.cngKg, co2e_kg: updatedCng * ef.cngKg } : null,
            refrigerant: updatedRefrigerant > 0 ? { qty: updatedRefrigerant, unit: 'kg', code: refCode, co2e_kg: updatedRefCo2 } : null,
            total_co2e_kg: updatedTotalCo2e,
            calculated_at: new Date().toISOString(),
            ef_version: ef.version,
          };

          const { error: updateError } = await supabase
            .from('emissions')
            .update({
              country_code: profile?.country ?? 'GB',
              electricity_kw: updatedElectricity,
diesel_litres: updatedDiesel,
petrol_litres: updatedPetrol,
gas_kwh: updatedGas,
lpg_kg: updatedLpg,
cng_kg: updatedCng,
refrigerant_kg: updatedRefrigerant,
refrigerant_code: refCode,
total_co2e: updatedTotalCo2e,
              ef_electricity: ef.electricity,
              ef_diesel: ef.diesel,
              ef_petrol: ef.petrol,
              ef_gas: ef.gas,
              ef_lpg: ef.lpgKg,
              ef_cng: ef.cngKg,
              calc_breakdown: updatedCalcBreakdown,
              ...(isEnterprise && selectedSiteId ? {
                site_id: selectedSiteId,
                org_id: availableSites.find(s => s.id === selectedSiteId)?.org_id ?? null,
              } : {}),
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;
          await supabase.from('report_locks').upsert({
            user_id: user.id,
            month: monthLabel,
            locked: true,
            locked_at: new Date().toISOString(),
          }, { onConflict: 'user_id,month' });
await supabase.from('edit_history').insert({
  user_id: user.id,
  month: monthLabel,
  entity: 'emissions',
  entity_id: existing.id,
  action: 'edit',
});

// Build field-level diff for activity log (only changed fields)
const changes: Record<string, { from: number; to: number }> = {};
const oldElec = existing.electricity_kw ?? existing.electricity_kwh ?? 0;
if (oldElec !== updatedElectricity) changes.electricity_kwh = { from: oldElec, to: updatedElectricity };
if ((existing.diesel_litres ?? 0) !== updatedDiesel) changes.diesel_l = { from: existing.diesel_litres ?? 0, to: updatedDiesel };
if ((existing.petrol_litres ?? 0) !== updatedPetrol) changes.petrol_l = { from: existing.petrol_litres ?? 0, to: updatedPetrol };
if ((existing.gas_kwh ?? 0) !== updatedGas) changes.gas_kwh = { from: existing.gas_kwh ?? 0, to: updatedGas };
if ((existing.refrigerant_kg ?? 0) !== updatedRefrigerant) changes.refrigerant_kg = { from: existing.refrigerant_kg ?? 0, to: updatedRefrigerant };
const oldCo2 = existing.total_co2e ?? 0;
if (Math.abs(oldCo2 - updatedTotalCo2e) > 0.01) changes.co2e_kg = { from: oldCo2, to: updatedTotalCo2e };
if (Object.keys(changes).length > 0) {
  logActivity('update', 'emission', { month: monthLabel, changes });
}

          scope12MessagePart = hasRealScope12 ? `Scope 1 & 2 updated for ${monthLabel}. ` : `Product output saved for ${monthLabel}. `;
        } else {
          // ADD MODE → INSERT NEW ROW
          const MONTH_NUMS: Record<string, string> = {
            January: '01', February: '02', March: '03', April: '04',
            May: '05', June: '06', July: '07', August: '08',
            September: '09', October: '10', November: '11', December: '12',
          };
          const monthKeyValue = `${year}-${MONTH_NUMS[monthName] ?? '01'}-01`;

          const calcBreakdown = {
            electricity: elec > 0 ? { qty: elec, unit: 'kWh', ef: ef.electricity, co2e_kg: elecCo2 } : null,
            diesel: diesel > 0 ? { qty: diesel, unit: 'L', ef: ef.diesel, co2e_kg: diesel * ef.diesel } : null,
            petrol: petrol > 0 ? { qty: petrol, unit: 'L', ef: ef.petrol, co2e_kg: petrol * ef.petrol } : null,
            gas: gas > 0 ? { qty: gas, unit: 'kWh', ef: ef.gas, co2e_kg: gas * ef.gas } : null,
            lpg: lpg > 0 ? { qty: lpg, unit: 'kg', ef: ef.lpgKg, co2e_kg: lpg * ef.lpgKg } : null,
            cng: cng > 0 ? { qty: cng, unit: 'kg', ef: ef.cngKg, co2e_kg: cng * ef.cngKg } : null,
            refrigerant: ref > 0 ? { qty: ref, unit: 'kg', code: refCode, co2e_kg: refCo2 } : null,
            total_co2e_kg: totalCo2e,
            calculated_at: new Date().toISOString(),
            ef_version: ef.version,
          };

          const { error: insertError } = await supabase
            .from('emissions')
            .insert({
              user_id: user.id,
              month: monthLabel,
              month_key: monthKeyValue,
              country_code: profile?.country ?? 'GB',
              electricity_kw: elec,
              diesel_litres: diesel,
              petrol_litres: petrol,
              gas_kwh: gas,
              lpg_kg: lpg,
              cng_kg: cng,
              refrigerant_kg: ref,
              refrigerant_code: refCode,
              total_co2e: totalCo2e,
              data_source: 'manual',
              ef_version: ef.version,
              ef_electricity: ef.electricity,
              ef_diesel: ef.diesel,
              ef_petrol: ef.petrol,
              ef_gas: ef.gas,
              ef_lpg: ef.lpgKg,
              ef_cng: ef.cngKg,
              calc_breakdown: calcBreakdown,
            ...(isEnterprise && selectedSiteId ? {
              site_id: selectedSiteId,
              org_id: availableSites.find(s => s.id === selectedSiteId)?.org_id ?? null,
            } : {}),
            });
if (insertError) throw insertError;
          await supabase.from('report_locks').upsert({
            user_id: user.id,
            month: monthLabel,
            locked: true,
            locked_at: new Date().toISOString(),
          }, { onConflict: 'user_id,month' });

await supabase.from('edit_history').insert({
  user_id: user.id,
  month: monthLabel,
  entity: 'emissions',
  entity_id: null, // insert
  action: 'add',
});
logActivity('create', 'emission', {
  month: monthLabel,
  electricity_kwh: elec || undefined,
  diesel_l: diesel || undefined,
  petrol_l: petrol || undefined,
  gas_kwh: gas || undefined,
  refrigerant_kg: ref || undefined,
  co2e_kg: totalCo2e,
});

      
          


          scope12MessagePart = hasRealScope12 ? `Scope 1 & 2 saved for ${monthLabel}. ` : `Product output saved for ${monthLabel}. `;
        }
      }

      // ----------------------------------
// SCOPE 3 — INSERT OR UPDATE (FIXED)
// ----------------------------------
if (hasScope3Activity) {
  if (isScope3EditMode && editingId) {
    const { error } = await supabase
      .from('scope3_activities')
      .update({
        category: scope3Category,
        label: scope3Label || null,
        data: {
          activity_value: parsedActivity,
          unit: activeScope3Config.unitLabel,
          factor_kg_per_unit: activeScope3Config.factorKgPerUnit,
        },
        co2e_kg: calculatedScope3Kg,
      })
      .eq('id', editingId);

    if (error) throw error;
await supabase.from('edit_history').insert({
  user_id: user.id,
  month: monthLabel,
  entity: 'scope3',
  entity_id: editingId,
  action: 'edit',
});



    scope3MessagePart = `Scope 3 updated (${calculatedScope3Kg.toFixed(
      1
    )} kg CO₂e).`;
  } else {
    const { error } = await supabase
      .from('scope3_activities')
      .insert({
        user_id: user.id,
        month: monthLabel,
        category: scope3Category,
        label: scope3Label || null,
        data: {
          activity_value: parsedActivity,
          unit: activeScope3Config.unitLabel,
          factor_kg_per_unit: activeScope3Config.factorKgPerUnit,
        },
        co2e_kg: calculatedScope3Kg,
      });

    if (error) throw error;
await supabase.from('edit_history').insert({
  user_id: user.id,
  month: monthLabel,
  entity: 'scope3',
  entity_id: null, // new row
  action: 'add',
});

    scope3MessagePart = `Scope 3 activity recorded (${calculatedScope3Kg.toFixed(
      1
    )} kg CO₂e).`;
  }
}

      // ----------------------------------
      // PRODUCTION OUTPUT (India only) — separate table, never touches emissions
      // ----------------------------------
      if (isIndia && productOutput !== '' && Number(productOutput) > 0) {
        const monthParts = monthLabel.split(' ');
        const MONTH_NUMS: Record<string, string> = {
          January: '01', February: '02', March: '03', April: '04',
          May: '05', June: '06', July: '07', August: '08',
          September: '09', October: '10', November: '11', December: '12',
        };
        const monthKey = `${monthParts[1]}-${MONTH_NUMS[monthParts[0]] ?? '01'}-01`;

        const { data: existingProd } = await supabase
          .from('production_entries')
          .select('id, quantity, unit')
          .eq('user_id', user.id)
          .eq('month_key', monthKey)
          .maybeSingle();

        if (existingProd) {
          await supabase
            .from('production_entries')
            .update({ quantity: Number(productOutput), unit: productUnit, updated_at: new Date().toISOString() })
            .eq('id', existingProd.id);

          // Audit trail
          await supabase.from('edit_history').insert({
            user_id: user.id,
            month: monthLabel,
            entity: 'production_entry',
            entity_id: existingProd.id,
            action: 'edit',
            before: { quantity: existingProd.quantity, unit: existingProd.unit },
            after: { quantity: Number(productOutput), unit: productUnit },
          });
        } else {
          const { data: newProd } = await supabase
            .from('production_entries')
            .insert({
              user_id: user.id,
              month: monthLabel,
              month_key: monthKey,
              quantity: Number(productOutput),
              unit: productUnit,
            })
            .select()
            .single();

          // Audit trail
          await supabase.from('edit_history').insert({
            user_id: user.id,
            month: monthLabel,
            entity: 'production_entry',
            entity_id: newProd?.id ?? null,
            action: 'add',
            before: null,
            after: { quantity: Number(productOutput), unit: productUnit },
          });
        }
        logActivity('production_output', 'emission', {
          month: monthLabel,
          quantity: Number(productOutput),
          unit: productUnit,
        });
      }

      // ----------------------------------
      // WATER (India only)
      // ----------------------------------
      if (isIndia && indiaWaterEnabled && waterOpen && waterWithdrawnKl) {
        const wWithdrawn = Number(waterWithdrawnKl) || 0;
        const WATER_EF = 0.344;
        const waterCo2e = wWithdrawn * WATER_EF;
        const periodMonth = MONTHS.indexOf(monthName) + 1;

        const { data: existingWater } = await supabase
          .from('water_entries')
          .select('id')
          .eq('account_id', user.id)
          .eq('period_month', periodMonth)
          .eq('period_year', year)
          .maybeSingle();

        const waterPayload = {
          account_id: user.id,
          period_month: periodMonth,
          period_year: year,
          source_type: waterSourceType,
          volume_withdrawn_kl: wWithdrawn,
          volume_consumed_kl: Number(waterConsumedKl) || null,
          volume_discharged_kl: Number(waterDischargedKl) || null,
          discharge_destination: waterDischargeDestination || null,
          co2e_kg: waterCo2e,
          ef_version: 'DEFRA_2024',
          data_source: 'manual',
        };

        if (existingWater) {
          const { error: we } = await supabase.from('water_entries').update(waterPayload).eq('id', existingWater.id);
          if (we) throw we;
        } else {
          const waterPayloadFinal = isEnterprise && selectedSiteId ? { ...waterPayload, site_id: selectedSiteId, org_id: availableSites.find(s => s.id === selectedSiteId)?.org_id ?? null } : waterPayload;
          const { error: we } = await supabase.from('water_entries').insert(waterPayloadFinal);
          if (we) throw we;
        }
      }

      // ----------------------------------
      // WASTE (India only)
      // ----------------------------------
      if (isIndia && indiaWasteEnabled && wasteOpen && wasteTotalKg) {
        const wLandfill = Number(wasteLandfillKg) || 0;
        const wTotal = Number(wasteTotalKg) || 0;
        const WASTE_EF = 0.587;
        // If landfill split not provided, use total as CO₂e basis
        const wasteCo2e = (wLandfill > 0 ? wLandfill : wTotal) * WASTE_EF;
        const periodMonth = MONTHS.indexOf(monthName) + 1;

        const { data: existingWaste } = await supabase
          .from('waste_entries')
          .select('id')
          .eq('account_id', user.id)
          .eq('period_month', periodMonth)
          .eq('period_year', year)
          .maybeSingle();

        const wastePayload = {
          account_id: user.id,
          period_month: periodMonth,
          period_year: year,
          total_kg: Number(wasteTotalKg) || 0,
          landfill_kg: wLandfill || null,
          recycled_kg: Number(wasteRecycledKg) || null,
          incinerated_kg: Number(wasteIncineratedKg) || null,
          hazardous_kg: Number(wasteHazardousKg) || null,
          co2e_kg: wasteCo2e,
          ef_version: 'DEFRA_2024',
          data_source: 'manual',
        };

        if (existingWaste) {
          const { error: wse } = await supabase.from('waste_entries').update(wastePayload).eq('id', existingWaste.id);
          if (wse) throw wse;
        } else {
          const wastePayloadFinal = isEnterprise && selectedSiteId ? { ...wastePayload, site_id: selectedSiteId, org_id: availableSites.find(s => s.id === selectedSiteId)?.org_id ?? null } : wastePayload;
          const { error: wse } = await supabase.from('waste_entries').insert(wastePayloadFinal);
          if (wse) throw wse;
        }
      }

      // ----------------------------------
      // AIR (India only, annual)
      // ----------------------------------
      if (isIndia && indiaAirEnabled && airOpen && (airNox || airSox || airPm)) {
        const { data: existingAir } = await supabase
          .from('air_emissions')
          .select('id')
          .eq('account_id', user.id)
          .eq('period_year', airFY)
          .maybeSingle();

        const airPayload = {
          account_id: user.id,
          period_year: airFY,
          nox_tonnes: airNox ? parseFloat(airNox) : null,
          sox_tonnes: airSox ? parseFloat(airSox) : null,
          pm_tonnes:  airPm  ? parseFloat(airPm)  : null,
          other_pollutant_name:   airOtherName || null,
          other_pollutant_tonnes: airOtherTonnes ? parseFloat(airOtherTonnes) : null,
          data_source: 'manual',
          created_by: user.id,
        };

        if (existingAir) {
          const { error: ae } = await supabase.from('air_emissions').update(airPayload).eq('id', existingAir.id);
          if (ae) throw ae;
        } else {
          const airPayloadFinal = isEnterprise && selectedSiteId ? { ...airPayload, site_id: selectedSiteId, org_id: availableSites.find(s => s.id === selectedSiteId)?.org_id ?? null } : airPayload;
          const { error: ae } = await supabase.from('air_emissions').insert(airPayloadFinal);
          if (ae) throw ae;
        }
      }

      const waterSavedPart = (isIndia && indiaWaterEnabled && waterOpen && waterWithdrawnKl) ? 'Water saved. ' : '';
      const wasteSavedPart = (isIndia && indiaWasteEnabled && wasteOpen && wasteTotalKg) ? 'Waste saved. ' : '';
      const airSavedPart   = (isIndia && indiaAirEnabled && airOpen && (airNox || airSox || airPm)) ? `Air FY${String(airFY).slice(2)}–${String(airFY + 1).slice(2)} saved. ` : '';
      const combinedMsg = `${scope12MessagePart}${scope3MessagePart}${waterSavedPart}${wasteSavedPart}${airSavedPart}`.trim();
      setMessage(combinedMsg || 'Saved.');
      // Invalidate India env cache so view-emissions shows fresh data
      if (waterSavedPart || wasteSavedPart || airSavedPart) {
        try { sessionStorage.removeItem('greenio_india_env_v1'); } catch {}
      }

      if (!isEditMode) {
        setElectricityKwh('');
        setDieselLitres('');
        setPetrolLitres('');
        setGasKwh('');
        setLpgKg('');
        setCngKg('');
        setRefrigerantKg('');
        setScope3ActivityValue('');
        setScope3Label('');
        setProductOutput('');
        setProductUnit('tonnes');
      } else {
        setTimeout(() => {
          router.push('/dashboard/emissions/view-emissions');
          router.refresh();
        }, 300);
      }
    } catch (err: any) {
      console.error('SAVE ERROR:', err);
      setError(err.message || 'Something went wrong while saving.');
    } finally {
      setLoading(false);
    }
  }
  const heading = isEditMode
    ? 'Edit monthly emissions'
    : 'Add monthly emissions';

  const subCopy = isEditMode
    ? 'Update fuel, electricity and refrigerant activity for an existing month. You can also add a simple Scope 3 activity.'
    : 'Log fuel, electricity and refrigerant activity for a single month. You can also add a simple Scope 3 activity in the same step.';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        {/* HEADER CARD */}
        <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-white via-white to-emerald-50 px-4 py-4 sm:px-6 sm:py-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* LEFT SIDE TEXT */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">
                Emissions · Scope 1 &amp; 2 (+ Scope 3)
              </p>

              <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900">
                {heading}
              </h1>

              <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-md">
                {subCopy}
              </p>

              <p className="mt-2 text-[11px] text-slate-500">
                We store emissions as a single record per month (e.g. "
                <span className="font-medium">
                  {buildMonthLabel(monthName, year)}
                </span>
                ") and automatically combine multiple entries when you add more
                data for the same month.
              </p>

              {isEditMode && (
                <p className="mt-1 text-[11px] text-emerald-700">
                  You&apos;re editing an existing month. Changes here will
                  replace the saved totals for this month.
                </p>
              )}
            </div>

            {/* RIGHT-SIDE CARD */}
            <div className="w-full sm:w-auto">
              <div className="rounded-2xl border border-emerald-100 bg-white/70 px-3 py-3 sm:px-4 sm:py-3 flex flex-col gap-3 sm:min-w-[260px]">
                <div className="text-[11px] text-slate-600">
                  <p className="font-medium text-slate-800">
                    One combined record per month.
                  </p>
                  <p className="mt-1">
                    Perfect for entering monthly totals from bills, fuel cards
                    or meter reads, plus one optional Scope 3 line item.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <Link
                    href="/dashboard/emissions/view-emissions"
                    className="h-[30px] px-3 rounded-full border border-slate-300 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-900 hover:text-white flex items-center justify-center"
                  >
                    View emissions history
                  </Link>

                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                  >
                    ← Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FORM SECTION */}
        <section className="rounded-xl bg-white border p-6 shadow">
          {/* ENTRY MODE TABS */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setEntryMode('manual')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                entryMode === 'manual'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Enter manually
            </button>
            <button
              type="button"
              onClick={() => { setEntryMode('scan'); setBillSuggestion(null); setBillError(null); }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                entryMode === 'scan'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Scan a bill
            </button>
            <button
              type="button"
              onClick={() => { setEntryMode('tally'); setTallyResult(null); setTallyError(null); setTallyFile(null); }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                entryMode === 'tally'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Import from Tally
            </button>
            <button
              type="button"
              onClick={() => { setEntryMode('bulk'); setBulkResult(null); setBulkSaveResult(null); setBulkError(null); setBulkFile(null); }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border ${
                entryMode === 'bulk'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Bulk Upload
            </button>
          </div>

          {entryMode === 'bulk' ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-slate-800">Bulk Upload</p>
                <p className="mt-1 text-xs text-slate-500">
                  Upload multiple months at once using the Greenio bulk upload template. Download the template, fill in your data, and upload it here.
                </p>
                <a
                  href="/templates/Greenio_Bulk_Upload_Template.xlsx"
                  download
                  className="mt-2 inline-block text-xs text-emerald-600 underline"
                >
                  Download template →
                </a>
              </div>

              {!bulkResult && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Upload filled template (.xlsx)</label>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={e => { setBulkFile(e.target.files?.[0] ?? null); setBulkError(null); }}
                      className="block text-xs text-slate-600"
                    />
                  </div>
                  {bulkError && <p className="text-xs text-red-600">{bulkError}</p>}
                  <button
                    type="button"
                    onClick={handleBulkParse}
                    disabled={!bulkFile || bulkParsing}
                    className="px-4 py-2 text-xs font-medium bg-slate-800 text-white rounded-lg disabled:opacity-40"
                  >
                    {bulkParsing ? 'Reading file…' : 'Preview data'}
                  </button>
                </div>
              )}

              {bulkResult && !bulkSaveResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <span className="font-medium">{bulkResult.valid_count} rows ready</span>
                    {bulkResult.skipped_count > 0 && (
                      <span className="text-amber-600">{bulkResult.skipped_count} skipped</span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setBulkResult(null); setBulkFile(null); setBulkError(null); }}
                      className="ml-auto text-slate-400 hover:text-slate-600 underline"
                    >
                      Upload different file
                    </button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Month</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Electricity</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Diesel</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Petrol</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">LPG</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">CNG</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Gas</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Refrig.</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Output</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkResult.rows.map((row: any, i: number) => (
                          <tr key={i} className={`border-b last:border-0 ${row.is_update ? 'bg-amber-50' : ''}`}>
                            <td className="px-3 py-2 text-slate-800">
                              {row.month}
                              {row.is_update && <p className="text-[10px] text-amber-600 font-normal">existing + upload</p>}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">
                              {row.is_update
                                ? row.final_electricity > 0 ? <span className="font-medium text-slate-800">{row.final_electricity} kWh</span> : '—'
                                : row.electricity > 0 ? `${row.electricity} kWh` : '—'}
                              {row.is_update && row.electricity > 0 && <p className="text-[10px] text-slate-400">+{row.electricity}</p>}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">
                              {row.is_update
                                ? row.final_diesel > 0 ? <span className="font-medium text-slate-800">{row.final_diesel} L</span> : '—'
                                : row.diesel > 0 ? `${row.diesel} L` : '—'}
                              {row.is_update && row.diesel > 0 && <p className="text-[10px] text-slate-400">+{row.diesel}</p>}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">
                              {row.is_update
                                ? row.final_petrol > 0 ? <span className="font-medium text-slate-800">{row.final_petrol} L</span> : '—'
                                : row.petrol > 0 ? `${row.petrol} L` : '—'}
                              {row.is_update && row.petrol > 0 && <p className="text-[10px] text-slate-400">+{row.petrol}</p>}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">
                              {row.is_update
                                ? row.final_lpg > 0 ? <span className="font-medium text-slate-800">{row.final_lpg} kg</span> : '—'
                                : row.lpg > 0 ? `${row.lpg} kg` : '—'}
                              {row.is_update && row.lpg > 0 && <p className="text-[10px] text-slate-400">+{row.lpg}</p>}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">
                              {row.is_update
                                ? row.final_cng > 0 ? <span className="font-medium text-slate-800">{row.final_cng} kg</span> : '—'
                                : row.cng > 0 ? `${row.cng} kg` : '—'}
                              {row.is_update && row.cng > 0 && <p className="text-[10px] text-slate-400">+{row.cng}</p>}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">
                              {row.is_update
                                ? row.final_gas > 0 ? <span className="font-medium text-slate-800">{row.final_gas} kWh</span> : '—'
                                : row.gas > 0 ? `${row.gas} kWh` : '—'}
                              {row.is_update && row.gas > 0 && <p className="text-[10px] text-slate-400">+{row.gas}</p>}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">
                              {row.is_update
                                ? row.final_refrigerant > 0 ? <span className="font-medium text-slate-800">{row.final_refrigerant} kg</span> : '—'
                                : row.refrigerant > 0 ? `${row.refrigerant} kg` : '—'}
                              {row.is_update && row.refrigerant > 0 && <p className="text-[10px] text-slate-400">+{row.refrigerant}</p>}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">{row.production_output != null ? row.production_output : '—'}</td>
                            <td className="px-3 py-2">
                              {row.is_update ? (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">Consolidate</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">New</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {bulkResult.rows.some((r: any) => r.is_update) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
                      <p className="text-[11px] text-amber-800">
                        <b>Consolidate</b> — months marked amber already have data. The bold value shows the combined total (existing + this upload). The grey +value shows what this upload adds.
                      </p>
                    </div>
                  )}

                  {bulkResult.skipped_rows.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-amber-600 font-medium">{bulkResult.skipped_count} rows skipped — click to see why</summary>
                      <ul className="mt-2 space-y-1 text-slate-500">
                        {bulkResult.skipped_rows.map((row: any, i: number) => (
                          <li key={i}>Row {row.row_number} — {row.skip_reason}</li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {bulkError && <p className="text-xs text-red-600">{bulkError}</p>}

                  <button
                    type="button"
                    onClick={handleBulkSave}
                    disabled={bulkSaving || bulkResult.valid_count === 0}
                    className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg disabled:opacity-40"
                  >
                    {bulkSaving ? 'Saving…' : `Save ${bulkResult.valid_count} months`}
                  </button>
                </div>
              )}

              {bulkSaveResult && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                  <p className="text-sm font-medium text-emerald-800">Upload complete</p>
                  <p className="text-xs text-emerald-700">
                    {bulkSaveResult.saved > 0 && <span>{bulkSaveResult.saved} new month{bulkSaveResult.saved !== 1 ? 's' : ''} saved. </span>}
                    {bulkSaveResult.updated > 0 && <span>{bulkSaveResult.updated} month{bulkSaveResult.updated !== 1 ? 's' : ''} updated. </span>}
                  </p>
                  {bulkSaveResult.errors.length > 0 && (
                    <ul className="text-xs text-red-600 space-y-0.5">
                      {bulkSaveResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => { setBulkResult(null); setBulkSaveResult(null); setBulkFile(null); setEntryMode('manual'); }}
                    className="mt-1 text-xs text-emerald-700 underline"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          ) : entryMode === 'tally' ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-slate-800">Import from Tally</p>
                <p className="mt-1 text-xs text-slate-500">
                  Export your Day Book from Tally for this month and upload it here. Greenio will read your ledger entries and pre-fill the emission form.{' '}
                  <a href="/help/tally-import" className="text-emerald-600 underline">How to export →</a>
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-700">Which month is this export for?</p>
                <div className="flex flex-wrap gap-3">
                  <select
                    value={monthName}
                    onChange={e => setMonthName(e.target.value)}
                    className="border rounded-full px-3 py-1.5 text-xs bg-white"
                  >
                    {MONTHS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={year}
                    onChange={e => setYear(Number(e.target.value) || currentYear)}
                    className="border rounded-full px-3 py-1.5 text-xs bg-white w-24"
                    min={currentYear - 10}
                    max={currentYear + 10}
                  />
                </div>
                <p className="text-[11px] text-slate-400">Make sure this matches the date range you exported from Tally.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">Day Book export (.xlsx)</label>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100">
                  <span className="text-xs text-slate-500">Click to upload Tally Day Book</span>
                  <span className="mt-1 text-[11px] text-slate-400">Excel (.xlsx) only · TallyPrime and Tally ERP 9 supported</span>
                  <input
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={e => {
                      setTallyFile(e.target.files?.[0] ?? null);
                      setTallyResult(null);
                      setTallyError(null);
                    }}
                  />
                </label>
                {tallyFile && <p className="mt-1 text-[11px] text-slate-600">{tallyFile.name}</p>}
              </div>

              <button
                type="button"
                disabled={!tallyFile || tallyParsing}
                onClick={handleTallyParse}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-5 py-2 hover:bg-slate-800 disabled:opacity-50"
              >
                {tallyParsing ? 'Reading your file…' : 'Parse Day Book →'}
              </button>

              {tallyError === 'wrong_report' && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-2">
                  <p className="text-xs font-semibold text-rose-800">Wrong report exported</p>
                  <p className="text-xs text-rose-700">This doesn&apos;t look like a Day Book export. Greenio needs the Day Book report, not a Ledger or Balance Sheet.</p>
                  <a href="/help/tally-import#step-1" className="text-xs text-rose-700 font-medium underline">See how to export the correct report →</a>
                </div>
              )}

              {tallyError === 'empty' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold text-amber-800">No purchase entries found</p>
                  <p className="text-xs text-amber-700 mt-1">The Day Book for this period has no purchase or payment entries. Check that you exported the correct month and try again.</p>
                </div>
              )}

              {tallyError === 'parse_error' && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-2">
                  <p className="text-xs font-semibold text-rose-800">Could not read file</p>
                  <p className="text-xs text-rose-700">Something went wrong reading your file. Make sure it&apos;s a valid Excel export from Tally and try again.</p>
                  <a href="/help/tally-import" className="text-xs text-rose-700 font-medium underline">View the import guide →</a>
                </div>
              )}

              {tallyResult?.status === 'ok' && (
                <div className="space-y-4">
                  {tallyResult.month_detected && tallyResult.month_detected !== buildMonthLabel(monthName, year) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-xs text-amber-800">
                        <b>Check your month selection.</b> Your file contains data for <b>{tallyResult.month_detected}</b> but you&apos;ve selected <b>{buildMonthLabel(monthName, year)}</b> above.
                      </p>
                    </div>
                  )}

                  <p className="text-xs font-semibold text-slate-800">
                    We found {tallyResult.ledgers.filter(l => l.match_status !== 'skipped').length} ledger{tallyResult.ledgers.filter(l => l.match_status !== 'skipped').length !== 1 ? 's' : ''} — review and confirm below.
                  </p>

                  {tallyResult.ledgers.map(ledger => {
                    const mapping = tallyMappings[ledger.tally_name] ?? '';
                    const quantity = tallyQuantities[ledger.tally_name] ?? '';
                    const isSkipped = mapping === 'skip';
                    const needsMapping = !mapping;
                    const needsQuantity = mapping && mapping !== 'skip' && !quantity;

                    const UNIT_LABELS: Record<string, string> = {
                      electricity: 'kWh', diesel: 'litres', petrol: 'litres',
                      lpg: 'kg', cng: 'kg', gas: 'kWh', refrigerant: 'kg',
                    };
                    const QUANTITY_HINTS: Record<string, string> = {
                      electricity: 'Enter kWh from your electricity bill',
                      diesel: 'Enter litres from your fuel invoice',
                      petrol: 'Enter litres from your fuel invoice',
                      lpg: 'Enter kg · 1 standard cylinder = 14.2 kg',
                      cng: 'Enter kg from your CNG invoice',
                      gas: 'Enter kWh from your gas bill',
                      refrigerant: 'Enter kg of refrigerant topped up',
                    };

                    return isSkipped ? (
                      <div key={ledger.tally_name} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between opacity-60">
                        <div>
                          <p className="text-xs font-medium text-slate-600">{ledger.tally_name}</p>
                          <p className="text-[11px] text-slate-400">&#8377;{ledger.total_debit.toLocaleString('en-IN')} · Skipped</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTallyMappings(prev => ({ ...prev, [ledger.tally_name]: '' }))}
                          className="text-[11px] text-slate-400 hover:text-slate-600 underline underline-offset-2"
                        >
                          Undo skip
                        </button>
                      </div>
                    ) : (
                      <div
                        key={ledger.tally_name}
                        className={`rounded-xl border p-4 space-y-3 transition-colors ${
                          needsMapping ? 'border-amber-300 bg-amber-50' :
                          needsQuantity ? 'border-orange-300 bg-orange-50' :
                          'border-emerald-200 bg-emerald-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{ledger.tally_name}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {ledger.entry_count > 1 ? `${ledger.entry_count} entries combined` : '1 entry'}
                              {' · '}&#8377;{ledger.total_debit.toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {ledger.flag === 'new_ledger' && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">New ledger</span>
                            )}
                            {ledger.flag === 'combined_entries' && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">Combined</span>
                            )}
                            {ledger.match_status === 'auto_matched' && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Auto-matched</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-slate-700">
                            What is this?{needsMapping && <span className="text-amber-600 ml-1">Required</span>}
                          </label>
                          <select
                            value={mapping}
                            onChange={e => setTallyMappings(prev => ({ ...prev, [ledger.tally_name]: e.target.value }))}
                            className="mt-1 w-full border rounded-lg px-3 py-2 text-xs bg-white"
                          >
                            <option value="">Select emission source…</option>
                            <option value="diesel">Diesel</option>
                            <option value="petrol">Petrol</option>
                            <option value="lpg">LPG</option>
                            <option value="cng">CNG</option>
                            <option value="gas">Natural Gas / PNG</option>
                            <option value="electricity">Electricity</option>
                            <option value="refrigerant">Refrigerant</option>
                            <option value="skip">Skip — not an emission source</option>
                          </select>
                        </div>

                        {mapping && mapping !== 'skip' && (
                          <div>
                            <label className="text-[11px] font-medium text-slate-700">
                              Quantity this month
                              {needsQuantity && <span className="text-orange-600 ml-1">Required</span>}
                            </label>
                            <p className="text-[10px] text-slate-400 mt-0.5">{QUANTITY_HINTS[mapping]}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={quantity}
                                onChange={e => setTallyQuantities(prev => ({ ...prev, [ledger.tally_name]: e.target.value }))}
                                className="w-36 border rounded-lg px-3 py-2 text-xs bg-white"
                                placeholder="e.g. 450"
                              />
                              <span className="text-xs text-slate-500">{UNIT_LABELS[mapping]}</span>
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setTallyMappings(prev => ({ ...prev, [ledger.tally_name]: 'skip' }))}
                          className="text-[11px] text-slate-400 hover:text-slate-600 underline underline-offset-2"
                        >
                          Skip this ledger
                        </button>
                      </div>
                    );
                  })}

                  {(() => {
                    const ready = tallyResult.ledgers.filter(l => {
                      const m = tallyMappings[l.tally_name];
                      const q = tallyQuantities[l.tally_name];
                      return m && m !== 'skip' && q && Number(q) > 0;
                    });
                    const needsAttention = tallyResult.ledgers.filter(l => {
                      const m = tallyMappings[l.tally_name];
                      return m !== 'skip' && (!m || !tallyQuantities[l.tally_name]);
                    });
                    return (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
                        <p className="text-xs font-semibold text-slate-800">Summary</p>
                        <p className="text-xs text-slate-600">
                          {ready.length} source{ready.length !== 1 ? 's' : ''} ready to apply
                          {needsAttention.length > 0 && (
                            <span className="text-amber-600 ml-2">· {needsAttention.length} still need{needsAttention.length === 1 ? 's' : ''} attention</span>
                          )}
                        </p>
                      </div>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={handleTallyApply}
                    disabled={!tallyResult.ledgers.some(l => {
                      const m = tallyMappings[l.tally_name];
                      const q = tallyQuantities[l.tally_name];
                      return m && m !== 'skip' && q && Number(q) > 0;
                    })}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-700 text-white text-xs font-medium px-5 py-2 hover:bg-emerald-800 disabled:opacity-50"
                  >
                    Apply to emissions form →
                  </button>
                </div>
              )}
            </div>
          ) : entryMode === 'scan' ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-slate-800">Scan a bill</p>
                <p className="mt-1 text-xs text-slate-500">
                  Upload a photo or image of your bill and we&apos;ll extract the key numbers for you to review.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Bill type</label>
                <select
                  value={billDocType}
                  onChange={(e) => {
                    setBillDocType(e.target.value as 'electricity' | 'diesel' | 'petrol' | 'gas' | 'refrigerant');
                    setBillSuggestion(null);
                  }}
                  className="border rounded-lg px-3 py-2 text-xs bg-white w-48"
                >
                  <option value="electricity">Electricity</option>
                  <option value="diesel">Diesel</option>
                  <option value="petrol">Petrol</option>
                  <option value="gas">Gas</option>
                  <option value="refrigerant">Refrigerant</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">Bill image or PDF</label>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100">
                  <span className="text-xs text-slate-500">Click to upload bill</span>
                  <span className="mt-1 text-[11px] text-slate-400">PDF · JPEG · PNG · WEBP supported</span>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      setBillFile(e.target.files?.[0] ?? null);
                      setBillSuggestion(null);
                      setBillError(null);
                    }}
                  />
                </label>
                {billFile && (
                  <p className="mt-1 text-[11px] text-slate-600">{billFile.name}</p>
                )}
              </div>

              <button
                type="button"
                disabled={!billFile || billScanning}
                onClick={handleBillScan}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-5 py-2 hover:bg-slate-800 disabled:opacity-50"
              >
                {billScanning ? 'Reading your bill…' : 'Extract from bill →'}
              </button>

              {billError && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {billError}
                </p>
              )}

              {billSuggestion && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                  <p className="text-xs font-semibold text-emerald-800">Extracted values — please review</p>
                  <div className="text-xs text-slate-700 space-y-1">
                    <p>Detected period: <span className="font-medium">{billSuggestion.month}</span></p>
                    {billSuggestion.electricity_kwh > 0 && (
                      <p>Electricity: <span className="font-medium">{billSuggestion.electricity_kwh.toLocaleString()} kWh</span></p>
                    )}
                    {billSuggestion.fuel_litres > 0 && (
                      <p>{billDocType === 'diesel' ? 'Diesel' : 'Petrol'}: <span className="font-medium">{billSuggestion.fuel_litres.toLocaleString()} L</span></p>
                    )}
                    {billSuggestion.gas_kwh > 0 && (
                      <p>Gas: <span className="font-medium">{billSuggestion.gas_kwh.toLocaleString()} kWh</span></p>
                    )}
                    {billSuggestion.refrigerant_kg > 0 && (
                      <p>Refrigerant: <span className="font-medium">{billSuggestion.refrigerant_kg} kg</span> ({billSuggestion.refrigerant_type})</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={applyBillSuggestion}
                    className="mt-2 inline-flex items-center justify-center rounded-full bg-emerald-700 text-white text-xs font-medium px-4 py-1.5 hover:bg-emerald-800"
                  >
                    Apply to form →
                  </button>
                </div>
              )}
            </div>
          ) : (
          isEnterprise && !enterpriseLoading && availableSites.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              No sites found. Please set up your organisation first.{' '}
              <a href="/organisation/enterprise" className="underline font-medium">
                Go to Organisation →
              </a>
            </div>
          ) : (
          <>
          {isEnterprise && orgRole === 'viewer' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 mb-4">
              You have view-only access to this organisation. Data entry is disabled.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* SITE SWITCHER — enterprise only */}
            {isEnterprise && availableSites.length > 0 && (
              <div className="mb-4">
                <label className="text-xs font-medium text-slate-600">
                  Site <span className="text-red-500">*</span>
                </label>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={selectedSiteId ?? ''}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                >
                  {availableSites.map(site => (
                    <option key={site.id} value={site.id}>
                      {site.name}{site.city ? ` — ${site.city}` : ''}
                      {site.is_primary ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* MONTH SELECTION */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Reporting month
              </p>

              <div className="mt-3 flex flex-wrap gap-3">
                <select
                  value={monthName}
                  onChange={(e) => setMonthName(e.target.value)}
                  className="border rounded-full px-3 py-1.5 text-xs bg-white"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  value={year}
                  onChange={(e) =>
                    setYear(Number(e.target.value) || currentYear)
                  }
                  className="border rounded-full px-3 py-1.5 text-xs bg-white w-24"
                  min={currentYear - 10}
                  max={currentYear + 10}
                />
              </div>
            </div>

            {/* SCOPE 1 + 2 GRID */}
            <div className="grid md:grid-cols-2 gap-5">
              {/* LEFT SIDE FIELDS */}
              <div className="space-y-4">
                {/* ELECTRICITY */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Electricity (kWh)
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={electricityKwh}
                    onChange={(e) => setElectricityKwh(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                    placeholder="e.g. 1,200"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Grid electricity used this month.
                  </p>
                </div>

                {/* ROAD FUEL BLOCK — mobile combustion */}
                <div className="border rounded-lg px-3 py-3 bg-slate-50 space-y-3">
                  <div>
                    <p className="text-[11px] font-medium text-slate-700">Road fuel</p>
                    <p className="text-[10px] text-slate-400">Fuel for company-owned vehicles.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        Diesel (L)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={dieselLitres}
                        onChange={(e) => setDieselLitres(e.target.value)}
                        className="w-full border rounded-lg px-2 py-1.5 text-[11px] bg-white"
                        placeholder="e.g. 350"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        Petrol (L)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={petrolLitres}
                        onChange={(e) => setPetrolLitres(e.target.value)}
                        className="w-full border rounded-lg px-2 py-1.5 text-[11px] bg-white"
                        placeholder="e.g. 120"
                      />
                    </div>
                  </div>
                </div>

                {/* STATIONARY FUEL BLOCK — stationary combustion */}
                <div className="border rounded-lg px-3 py-3 bg-slate-50 space-y-3">
                  <div>
                    <p className="text-[11px] font-medium text-slate-700">Stationary fuel</p>
                    <p className="text-[10px] text-slate-400">Fuel for heating, cooking &amp; on-site generators.</p>
                  </div>

                  {/* GAS */}
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      {isIndia ? 'Natural Gas / PNG (kWh)' : 'Natural Gas (kWh)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={gasKwh}
                      onChange={(e) => setGasKwh(e.target.value)}
                      className="w-full border rounded-lg px-2 py-1.5 text-[11px] bg-white"
                      placeholder="e.g. 800"
                    />
                  </div>

                  {/* LPG — India only */}
                  {isIndia && (
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        LPG (kg)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={lpgKg}
                        onChange={(e) => setLpgKg(e.target.value)}
                        className="w-full border rounded-lg px-2 py-1.5 text-[11px] bg-white"
                        placeholder="e.g. 45"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        LPG cylinders used. Standard cylinder = 14.2 kg
                      </p>
                    </div>
                  )}

                  {/* CNG — India only */}
                  {isIndia && (
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        CNG (kg)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cngKg}
                        onChange={(e) => setCngKg(e.target.value)}
                        className="w-full border rounded-lg px-2 py-1.5 text-[11px] bg-white"
                        placeholder="e.g. 50"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        CNG used. Standard cylinder varies by supplier.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT SIDE = REFRIGERANT */}
              <div className="space-y-4">
                {/* REFRIG KG */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Refrigerant (kg)
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={refrigerantKg}
                    onChange={(e) => setRefrigerantKg(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                    placeholder="e.g. 2.5"
                  />

                  <p className="mt-1 text-[11px] text-slate-500">
                    Top-ups or leaks across AC / cold-room systems this month.
                  </p>
                </div>

                {/* REFRIG TYPE */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Refrigerant gas
                  </label>

                  <select
                    value={refrigerantCode}
                    onChange={(e) => setRefrigerantCode(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                  >
                    {REFRIGERANT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <p className="mt-1 text-[11px] text-slate-500">
                    If unsure, leave as "Not sure / generic HFC".
                  </p>
                </div>

              </div>
            </div>
            {/* Scope 3 calculator */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Scope 3 (optional)
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Choose a category and enter simple activity data. We'll
                    estimate CO₂e and store it in your Scope 3 log.
                  </p>
                </div>

                <label className="flex items-center gap-2 text-[11px] text-slate-500">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-slate-300"
                    checked={scope3Enabled}
                    onChange={(e) => setScope3Enabled(e.target.checked)}
                  />
                  Enable
                </label>
              </div>

              {scope3Enabled && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Category
                      </label>
                      <select
                        value={scope3Category}
                        onChange={(e) => {
                          setScope3Category(e.target.value);
                          setScope3ActivityValue('');
                        }}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                      >
                        {SCOPE3_CATEGORIES.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1 md:col-span-1">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Label / description (optional)
                      </label>
                      <input
                        type="text"
                        value={scope3Label}
                        onChange={(e) => setScope3Label(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                        placeholder="e.g. Flights to client meetings"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-700">
                        {activeScope3Config.inputLabel}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={scope3ActivityValue}
                        onChange={(e) => setScope3ActivityValue(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                        placeholder={`e.g. 1,000 ${activeScope3Config.unitLabel}`}
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {activeScope3Config.helper}
                      </p>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span>
                      Estimated Scope 3 for this activity:{' '}
                      <span className="font-semibold">
                        {calculatedScope3Kg > 0
                          ? `${calculatedScope3Kg.toFixed(1)} kg CO₂e`
                          : '0 kg CO₂e'}
                      </span>
                    </span>

                    <span className="text-[10px] text-slate-500">
                      {activeScope3Config.factorKgPerUnit.toFixed(2)} kg CO₂e
                      per {activeScope3Config.unitLabel}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Product output (India / CCTS only) */}
            {isIndia && (
              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {}}
                  className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-500"
                  style={{ pointerEvents: 'none' }}
                >
                  <span>Production output</span>
                </button>
                <div className="mt-3 space-y-3">
                  <p className="text-[11px] text-slate-500">Units of product or service produced this month. Used to calculate GHG emission intensity (tCO₂e per unit output).</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Output quantity</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={productOutput}
                        onChange={(e) => setProductOutput(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                        placeholder="e.g. 500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Unit</label>
                      <select
                        value={productUnit}
                        onChange={(e) => setProductUnit(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                      >
                        <option value="tonnes">Tonnes</option>
                        <option value="units">Units</option>
                        <option value="kg">kg</option>
                        <option value="litres">Litres</option>
                        <option value="sqm">Square metres</option>
                        <option value="kwh">kWh</option>
                        <option value="mwh">MWh</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  {productOutput && Number(productOutput) > 0 && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                      Emission intensity will be calculated automatically when you save.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Water (India only) */}
            {isIndia && indiaWaterEnabled && (
              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setWaterOpen(!waterOpen)}
                  className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-500 hover:text-slate-700"
                >
                  <span>Water (optional)</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 transition-transform ${waterOpen ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                </button>
                {waterOpen && (
                  <div className="mt-3 space-y-3">
                    <p className="text-[11px] text-slate-500">Record monthly water consumption for BRSR reporting.</p>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">Source type</label>
                        <select
                          value={waterSourceType}
                          onChange={(e) => setWaterSourceType(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                        >
                          <option value="municipal">Municipal / piped</option>
                          <option value="groundwater">Groundwater</option>
                          <option value="rainwater">Rainwater harvested</option>
                          <option value="surface">Surface water</option>
                          <option value="treated_wastewater">Treated wastewater</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">Withdrawn (kL)</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={waterWithdrawnKl}
                          onChange={(e) => setWaterWithdrawnKl(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                          placeholder="e.g. 500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">Consumed (kL)</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={waterConsumedKl}
                          onChange={(e) => setWaterConsumedKl(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                          placeholder="optional"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">Discharged (kL)</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={waterDischargedKl}
                          onChange={(e) => setWaterDischargedKl(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                          placeholder="optional"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">Discharge destination</label>
                        <input
                          type="text"
                          value={waterDischargeDestination}
                          onChange={(e) => setWaterDischargeDestination(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                          placeholder="e.g. municipal sewage, river (optional)"
                        />
                      </div>
                    </div>
                    {Number(waterWithdrawnKl) > 0 && (
                      <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                        Estimated CO₂e: <span className="font-semibold">{(Number(waterWithdrawnKl) * 0.344).toFixed(1)} kg</span>
                        <span className="text-slate-400 ml-2">(0.344 kg/kL · DEFRA 2024)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Waste (India only) */}
            {isIndia && indiaWasteEnabled && (
              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setWasteOpen(!wasteOpen)}
                  className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-500 hover:text-slate-700"
                >
                  <span>Waste (optional)</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 transition-transform ${wasteOpen ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                </button>
                {wasteOpen && (
                  <div className="mt-3 space-y-3">
                    <p className="text-[11px] text-slate-500">Record monthly waste disposal for BRSR reporting. CO₂e is calculated on landfilled waste only.</p>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">Total waste (kg)</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={wasteTotalKg}
                          onChange={(e) => setWasteTotalKg(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                          placeholder="e.g. 200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">Landfilled (kg)</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={wasteLandfillKg}
                          onChange={(e) => setWasteLandfillKg(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                          placeholder="e.g. 80"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">Recycled (kg)</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={wasteRecycledKg}
                          onChange={(e) => setWasteRecycledKg(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                          placeholder="optional"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">Incinerated (kg)</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={wasteIncineratedKg}
                          onChange={(e) => setWasteIncineratedKg(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                          placeholder="optional"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">Hazardous (kg)</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={wasteHazardousKg}
                          onChange={(e) => setWasteHazardousKg(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                          placeholder="optional"
                        />
                      </div>
                    </div>
                    {(Number(wasteLandfillKg) > 0 || Number(wasteTotalKg) > 0) && (
                      <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                        Estimated CO₂e: <span className="font-semibold">{((Number(wasteLandfillKg) > 0 ? Number(wasteLandfillKg) : Number(wasteTotalKg)) * 0.587).toFixed(1)} kg</span>
                        <span className="text-slate-400 ml-2">{Number(wasteLandfillKg) > 0 ? '(0.587 kg/kg landfill · DEFRA 2024)' : '(0.587 kg/kg total · landfill assumed · DEFRA 2024)'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Air (India only, annual) */}
            {isIndia && indiaAirEnabled && (
              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAirOpen(!airOpen)}
                  className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-500 hover:text-slate-700"
                >
                  <span>Air emissions (optional · annual)</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 transition-transform ${airOpen ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                </button>
                {airOpen && (
                  <div className="mt-3 space-y-3">
                    <p className="text-[11px] text-slate-500">Annual air pollutant disclosure for BRSR Principle 6. No CO₂e — raw tonnes only.</p>
                    <div className="flex items-center gap-3">
                      <label className="text-[11px] font-medium text-slate-700">Financial year</label>
                      <div className="flex items-center gap-1 text-xs font-medium text-slate-800">
                        <span>FY</span>
                        <input
                          type="number"
                          value={airFY}
                          onChange={(e) => setAirFY(Number(e.target.value) || airFY)}
                          className="w-20 border rounded-lg px-2 py-1.5 text-xs bg-white"
                          min={2020}
                          max={2040}
                        />
                        <span>– {String(airFY + 1).slice(2)}</span>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">NOx (tonnes)</label>
                        <input
                          type="number" step="0.001" min="0"
                          value={airNox}
                          onChange={(e) => setAirNox(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                          placeholder="e.g. 0.5"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">SOx (tonnes)</label>
                        <input
                          type="number" step="0.001" min="0"
                          value={airSox}
                          onChange={(e) => setAirSox(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                          placeholder="e.g. 0.2"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">Particulate matter / PM (tonnes)</label>
                        <input
                          type="number" step="0.001" min="0"
                          value={airPm}
                          onChange={(e) => setAirPm(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                          placeholder="e.g. 0.1"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">Other pollutant name</label>
                        <input
                          type="text"
                          value={airOtherName}
                          onChange={(e) => setAirOtherName(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                          placeholder="e.g. CO, VOC (optional)"
                        />
                      </div>
                      {airOtherName && (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-1">{airOtherName} (tonnes)</label>
                          <input
                            type="number" step="0.001" min="0"
                            value={airOtherTonnes}
                            onChange={(e) => setAirOtherTonnes(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                            placeholder="e.g. 0.05"
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">From annual stack tests, CPCB compliance reports or environmental audits. One entry per financial year.</p>
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            {(error || message) && (
              <div className="text-xs">
                {error && (
                  <p className="text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                {message && (
                  <p className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mt-2">
                    {message}
                  </p>
                )}
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || (isEnterprise && orgRole === 'viewer')}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-5 py-2 hover:bg-slate-800 disabled:opacity-60"
              >
                {loading
                  ? 'Saving…'
                  : isEditMode
                  ? 'Update emissions'
                  : 'Save emissions'}
              </button>
            </div>
          </form>
          </>
          )
          )}
        </section>
      </div>
    </main>
  );
}

export default function EmissionsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EmissionsPageInner />
    </Suspense>
  );
}