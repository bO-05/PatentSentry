/*
  # Patent Monitoring System Schema

  1. New Tables
    - `watched_patents` - Patents users are actively monitoring
      - `id` (uuid, primary key)
      - `patent_id` (text, the USPTO patent number)
      - `patent_title` (text)
      - `filing_date` (date)
      - `grant_date` (date)
      - `expiration_date` (date, calculated)
      - `pta_days` (integer, Patent Term Adjustment)
      - `assignee` (text)
      - `notes` (text, user notes)
      - `alert_90_days` (boolean, alert 90 days before expiry)
      - `alert_30_days` (boolean, alert 30 days before expiry)
      - `alert_fee_deadline` (boolean, alert before maintenance fee deadlines)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `patent_analysis_cache` - Cached patent analysis data from USPTO
      - `id` (uuid, primary key)
      - `patent_id` (text, unique)
      - `raw_data` (jsonb, full USPTO response)
      - `filing_date` (date)
      - `grant_date` (date)
      - `pta_days` (integer)
      - `pte_days` (integer, Patent Term Extension for pharma)
      - `expiration_date` (date)
      - `maintenance_fee_events` (jsonb, fee payment history if available)
      - `terminal_disclaimers` (jsonb, TD information)
      - `source` (text, 'patentsview' | 'uspto_pair' | 'exa')
      - `fetched_at` (timestamptz)
      - `expires_at` (timestamptz, cache expiration)

    - `portfolio_groups` - Group patents into portfolios for bulk analysis
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `created_at` (timestamptz)

    - `portfolio_patents` - Junction table for portfolio membership
      - `id` (uuid, primary key)
      - `portfolio_id` (uuid, foreign key)
      - `patent_id` (text)
      - `added_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Public access for anonymous users (no auth required for MVP)

  3. Indexes
    - Index on patent_id for fast lookups
    - Index on expiration_date for alert queries
*/

-- Watched Patents table
CREATE TABLE IF NOT EXISTS watched_patents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patent_id text NOT NULL,
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

-- Patent Analysis Cache table
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
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

-- Portfolio Groups table
CREATE TABLE IF NOT EXISTS portfolio_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Portfolio Patents junction table
CREATE TABLE IF NOT EXISTS portfolio_patents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio_groups(id) ON DELETE CASCADE,
  patent_id text NOT NULL,
  patent_title text,
  added_at timestamptz DEFAULT now(),
  UNIQUE(portfolio_id, patent_id)
);

-- Enable RLS on all tables
ALTER TABLE watched_patents ENABLE ROW LEVEL SECURITY;
ALTER TABLE patent_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_patents ENABLE ROW LEVEL SECURITY;

-- For MVP without auth, allow public read/write
-- In production, these would be restricted to authenticated users
CREATE POLICY "Allow public read on watched_patents"
  ON watched_patents FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert on watched_patents"
  ON watched_patents FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update on watched_patents"
  ON watched_patents FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on watched_patents"
  ON watched_patents FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow public read on patent_analysis_cache"
  ON patent_analysis_cache FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert on patent_analysis_cache"
  ON patent_analysis_cache FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update on patent_analysis_cache"
  ON patent_analysis_cache FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read on portfolio_groups"
  ON portfolio_groups FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert on portfolio_groups"
  ON portfolio_groups FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update on portfolio_groups"
  ON portfolio_groups FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on portfolio_groups"
  ON portfolio_groups FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow public read on portfolio_patents"
  ON portfolio_patents FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert on portfolio_patents"
  ON portfolio_patents FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public delete on portfolio_patents"
  ON portfolio_patents FOR DELETE
  TO anon
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_watched_patents_patent_id ON watched_patents(patent_id);
CREATE INDEX IF NOT EXISTS idx_watched_patents_expiration ON watched_patents(expiration_date);
CREATE INDEX IF NOT EXISTS idx_watched_patents_fee_dates ON watched_patents(fee_3_5_year_date, fee_7_5_year_date, fee_11_5_year_date);
CREATE INDEX IF NOT EXISTS idx_patent_cache_patent_id ON patent_analysis_cache(patent_id);
CREATE INDEX IF NOT EXISTS idx_patent_cache_expires ON patent_analysis_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_portfolio_patents_portfolio ON portfolio_patents(portfolio_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for watched_patents
DROP TRIGGER IF EXISTS update_watched_patents_updated_at ON watched_patents;
CREATE TRIGGER update_watched_patents_updated_at
  BEFORE UPDATE ON watched_patents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
