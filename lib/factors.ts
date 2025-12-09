import { supabase } from './supabaseClient';

export type FactorSet = {
  version: string;
  electricity: number;
  diesel: number;
  petrol: number;
  gas: number;
  refrigerants: Record<string, number>;
};

export async function loadUKFactors(): Promise<FactorSet> {
  const { data, error } = await supabase
    .from('emission_factors')
    .select('*')
    .eq('version', 'DEFRA-2024-v1')
    .eq('region', 'UK');

  if (error || !data) {
    console.error('Factor load error:', error);
    throw new Error('Could not load emission factors from database');
  }

  // Extract categories
  const electricity = data.find((x) => x.category === 'electricity')?.factor;

  const diesel = data.find((x) => x.subcategory === 'Diesel')?.factor;

  const petrol = data.find((x) => x.subcategory === 'Petrol')?.factor;

  const gas = data.find((x) => x.subcategory === 'Natural Gas')?.factor;

  // Refrigerants → map them
  const refrigerants: Record<string, number> = {};
  data
    .filter((x) => x.category === 'refrigerant')
    .forEach((x) => (refrigerants[x.subcategory] = x.factor));

  return {
    version: 'DEFRA-2024-v1',
    electricity: electricity ?? 0,
    diesel: diesel ?? 0,
    petrol: petrol ?? 0,
    gas: gas ?? 0,
    refrigerants,
  };
}
