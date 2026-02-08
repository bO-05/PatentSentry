-- =============================================================================
-- PatentSentry Full Database Schema
-- Run this in Supabase SQL Editor to set up all tables
-- =============================================================================

-- 1. Search History Table
CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  patent_id text,
  searched_at timestamptz DEFAULT now()
);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON search_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON search_history FOR INSERT WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_search_history_searched_at ON search_history(searched_at DESC);

-- 2. Bookmarks Table
CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patent_id text NOT NULL,
  patent_title text,
  patent_date text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookmarks" ON bookmarks FOR SELECT USING (true);
CREATE POLICY "Users can insert own bookmarks" ON bookmarks FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete own bookmarks" ON bookmarks FOR DELETE USING (true);
CREATE INDEX IF NOT EXISTS idx_bookmarks_patent_id ON bookmarks(patent_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);

-- 3. Watched Patents Table
CREATE TABLE IF NOT EXISTS watched_patents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patent_id text NOT NULL UNIQUE,
  patent_title text,
  filing_date date,
  grant_date date,
  expiration_date date,
  pta_days integer DEFAULT 0,
  pte_days integer DEFAULT 0,
  assignee text,
  notes text,
  alert_90_days boolean DEFAULT true,
  alert_30_days boolean DEFAULT true,
  alert_fee_deadline boolean DEFAULT true,
  fee_3_5_year_date date,
  fee_7_5_year_date date,
  fee_11_5_year_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE watched_patents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on watched_patents" ON watched_patents FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert on watched_patents" ON watched_patents FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update on watched_patents" ON watched_patents FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on watched_patents" ON watched_patents FOR DELETE TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_watched_patents_patent_id ON watched_patents(patent_id);
CREATE INDEX IF NOT EXISTS idx_watched_patents_expiration ON watched_patents(expiration_date);
CREATE INDEX IF NOT EXISTS idx_watched_patents_fee_dates ON watched_patents(fee_3_5_year_date, fee_7_5_year_date, fee_11_5_year_date);

-- 4. Patent Analysis Cache Table
CREATE TABLE IF NOT EXISTS patent_analysis_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patent_id text UNIQUE NOT NULL,
  raw_data jsonb,
  filing_date date,
  grant_date date,
  pta_days integer DEFAULT 0,
  pte_days integer DEFAULT 0,
  expiration_date date,
  maintenance_fee_events jsonb,
  terminal_disclaimers jsonb,
  claims_count integer,
  cpc_codes jsonb,
  source text DEFAULT 'patentsview',
  fetched_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  access_count integer DEFAULT 1,
  last_accessed_at timestamptz DEFAULT now(),
  analysis_data jsonb
);

ALTER TABLE patent_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Read-only for anon; writes handled by service_role (bypasses RLS)
CREATE POLICY "Allow public read on patent_analysis_cache" ON patent_analysis_cache FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_patent_cache_patent_id ON patent_analysis_cache(patent_id);
CREATE INDEX IF NOT EXISTS idx_patent_cache_expires ON patent_analysis_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_patent_analysis_cache_fetched_at ON patent_analysis_cache(fetched_at);

-- 5. Portfolio Groups Table
CREATE TABLE IF NOT EXISTS portfolio_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE portfolio_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on portfolio_groups" ON portfolio_groups FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert on portfolio_groups" ON portfolio_groups FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update on portfolio_groups" ON portfolio_groups FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on portfolio_groups" ON portfolio_groups FOR DELETE TO anon USING (true);

-- 6. Portfolio Patents Junction Table
CREATE TABLE IF NOT EXISTS portfolio_patents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio_groups(id) ON DELETE CASCADE,
  patent_id text NOT NULL,
  patent_title text,
  added_at timestamptz DEFAULT now(),
  UNIQUE(portfolio_id, patent_id)
);

ALTER TABLE portfolio_patents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on portfolio_patents" ON portfolio_patents FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert on portfolio_patents" ON portfolio_patents FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public delete on portfolio_patents" ON portfolio_patents FOR DELETE TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_portfolio_patents_portfolio ON portfolio_patents(portfolio_id);

-- 7. Patent Enrichments Table (for Exa AI)
CREATE TABLE IF NOT EXISTS patent_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patent_id TEXT NOT NULL UNIQUE,
  assignee TEXT,
  company_news JSONB NOT NULL DEFAULT '[]'::jsonb,
  market_context JSONB NOT NULL DEFAULT '[]'::jsonb,
  product_mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE patent_enrichments ENABLE ROW LEVEL SECURITY;

-- No permissive policies; service_role bypasses RLS automatically
CREATE INDEX IF NOT EXISTS idx_patent_enrichments_expires ON patent_enrichments(patent_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_patent_enrichments_expires_only ON patent_enrichments(expires_at);

-- 8. Utility Function for updated_at (with secure search_path)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_watched_patents_updated_at ON watched_patents;
CREATE TRIGGER update_watched_patents_updated_at
  BEFORE UPDATE ON watched_patents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Done!
-- Now deploy the Edge Function and set your secrets.
