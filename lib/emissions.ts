// lib/emissions.ts
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🔧 Change if your table name is different
const TABLE_NAME = 'emissions';

export type EmissionRow = {
  id: string;
  [key: string]: any;
};

export async function getAllEmissions(): Promise<EmissionRow[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('month', { ascending: false }); // use your real column (month is correct)

  if (error) {
    console.error('Supabase select error:', error);
    throw error;
  }

  return (data ?? []) as EmissionRow[];
}
