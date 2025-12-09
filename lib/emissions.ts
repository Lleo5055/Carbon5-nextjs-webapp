// lib/emissions.ts
import { supabase } from './supabaseClients';

// 🔧 Change this to your actual table name if different
const TABLE_NAME = 'emissions'; // e.g. 'emission_entries' if that's what you used

export type EmissionRow = {
  id: string;
  [key: string]: any;
};

export async function getAllEmissions(): Promise<EmissionRow[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('date', { ascending: false }); // change 'date' to your real date column

  if (error) {
    console.error('Supabase select error:', error);
    throw error;
  }

  return (data ?? []) as EmissionRow[];
}
