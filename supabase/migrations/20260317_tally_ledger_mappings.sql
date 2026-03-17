create table if not exists tally_ledger_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tally_ledger_name text not null,
  emission_source text,
  skip boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, tally_ledger_name)
);

alter table tally_ledger_mappings enable row level security;

create policy "Users can manage own tally mappings"
  on tally_ledger_mappings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
