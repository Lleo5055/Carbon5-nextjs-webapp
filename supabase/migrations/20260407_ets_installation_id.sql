-- Add installation_id and ets_scheme to emissions table
-- Allows emission records to be tagged to a specific UK/EU ETS installation
-- installation_id is nullable: null = general site emission, set = ETS installation emission
-- ets_scheme: 'uk_ets' | 'eu_ets' | null

ALTER TABLE emissions
  ADD COLUMN IF NOT EXISTS installation_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ets_scheme text DEFAULT NULL;

-- Index for fast lookups by installation
CREATE INDEX IF NOT EXISTS idx_emissions_installation_id ON emissions (installation_id);
