-- Patent enrichment cache table for Exa AI results
-- Stores company news, market context, and product mentions

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

-- Index for TTL-based cache lookups
CREATE INDEX IF NOT EXISTS idx_patent_enrichments_expires 
  ON patent_enrichments(patent_id, expires_at);

-- Index for cleanup jobs
CREATE INDEX IF NOT EXISTS idx_patent_enrichments_expires_only 
  ON patent_enrichments(expires_at);

-- Enable RLS (service role bypasses RLS automatically)
ALTER TABLE patent_enrichments ENABLE ROW LEVEL SECURITY;

-- No permissive policies needed for patent_enrichments
-- Service role (used by Edge Functions) bypasses RLS automatically
-- This keeps the cache table private to server-side operations only

-- Comment for documentation
COMMENT ON TABLE patent_enrichments IS 'Cache for Exa AI patent enrichment data (company news, market context, product mentions)';
COMMENT ON COLUMN patent_enrichments.company_news IS 'Array of news articles about the assignee company';
COMMENT ON COLUMN patent_enrichments.market_context IS 'Array of market/industry context articles';
COMMENT ON COLUMN patent_enrichments.product_mentions IS 'Array of articles mentioning product commercialization';
