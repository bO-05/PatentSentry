/*
  # Add Access Tracking to Patent Analysis Cache

  Adds columns to track cache usage for analytics and optimization.

  1. Changes
    - Add `access_count` (integer) - How many times this cached entry was accessed
    - Add `last_accessed_at` (timestamptz) - When last accessed
    - Add `analysis_data` (jsonb) - Store full analysis response for faster retrieval

  2. Indexes
    - Index on fetched_at for cache invalidation queries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patent_analysis_cache' AND column_name = 'access_count'
  ) THEN
    ALTER TABLE patent_analysis_cache ADD COLUMN access_count integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patent_analysis_cache' AND column_name = 'last_accessed_at'
  ) THEN
    ALTER TABLE patent_analysis_cache ADD COLUMN last_accessed_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patent_analysis_cache' AND column_name = 'analysis_data'
  ) THEN
    ALTER TABLE patent_analysis_cache ADD COLUMN analysis_data jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patent_analysis_cache_fetched_at ON patent_analysis_cache(fetched_at);
