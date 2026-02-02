-- =============================================================================
-- PatentSentry Auth Migration
-- Adds user_id to user-owned tables with proper RLS policies
-- =============================================================================

-- IMPORTANT: This migration assumes no production data exists yet.
-- If you have data, back it up first.

-- 1. Add user_id columns with default to auth.uid()
-- Note: Adding as nullable first, then setting NOT NULL to handle IF NOT EXISTS properly

-- search_history
ALTER TABLE search_history ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE search_history ALTER COLUMN user_id SET NOT NULL;

-- bookmarks
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE bookmarks ALTER COLUMN user_id SET NOT NULL;

-- watched_patents
ALTER TABLE watched_patents ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE watched_patents ALTER COLUMN user_id SET NOT NULL;

-- portfolio_groups
ALTER TABLE portfolio_groups ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE portfolio_groups ALTER COLUMN user_id SET NOT NULL;

-- portfolio_patents
ALTER TABLE portfolio_patents ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE portfolio_patents ALTER COLUMN user_id SET NOT NULL;

-- 2. Create indices for user-scoped queries (do before constraints to handle existing nulls)
CREATE INDEX IF NOT EXISTS idx_search_history_user_time ON search_history(user_id, searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created ON bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watched_user_created ON watched_patents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_groups_user_created ON portfolio_groups(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_patents_user ON portfolio_patents(user_id);

-- 3. Fix uniqueness constraints to be per-user
-- bookmarks: unique per user+patent
DROP INDEX IF EXISTS idx_bookmarks_patent_id;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bookmarks_user_patent ON bookmarks(user_id, patent_id);

-- watched_patents: unique per user+patent
ALTER TABLE watched_patents DROP CONSTRAINT IF EXISTS watched_patents_patent_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_watched_user_patent ON watched_patents(user_id, patent_id);

-- 4. RLS Policies for search_history
DROP POLICY IF EXISTS "Allow public read access" ON search_history;
DROP POLICY IF EXISTS "Allow public insert access" ON search_history;
DROP POLICY IF EXISTS "search_history_select_own" ON search_history;
DROP POLICY IF EXISTS "search_history_insert_own" ON search_history;
DROP POLICY IF EXISTS "search_history_delete_own" ON search_history;

CREATE POLICY "search_history_select_own" ON search_history
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "search_history_insert_own" ON search_history
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "search_history_delete_own" ON search_history
  FOR DELETE USING (user_id = auth.uid());

-- 5. RLS Policies for bookmarks
DROP POLICY IF EXISTS "Users can view own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can insert own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_select_own" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_insert_own" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_delete_own" ON bookmarks;

CREATE POLICY "bookmarks_select_own" ON bookmarks
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "bookmarks_insert_own" ON bookmarks
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "bookmarks_delete_own" ON bookmarks
  FOR DELETE USING (user_id = auth.uid());

-- 6. RLS Policies for watched_patents
DROP POLICY IF EXISTS "Allow public read on watched_patents" ON watched_patents;
DROP POLICY IF EXISTS "Allow public insert on watched_patents" ON watched_patents;
DROP POLICY IF EXISTS "Allow public update on watched_patents" ON watched_patents;
DROP POLICY IF EXISTS "Allow public delete on watched_patents" ON watched_patents;
DROP POLICY IF EXISTS "watched_select_own" ON watched_patents;
DROP POLICY IF EXISTS "watched_insert_own" ON watched_patents;
DROP POLICY IF EXISTS "watched_update_own" ON watched_patents;
DROP POLICY IF EXISTS "watched_delete_own" ON watched_patents;

CREATE POLICY "watched_select_own" ON watched_patents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "watched_insert_own" ON watched_patents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "watched_update_own" ON watched_patents
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "watched_delete_own" ON watched_patents
  FOR DELETE USING (user_id = auth.uid());

-- 7. RLS Policies for portfolio_groups
DROP POLICY IF EXISTS "Allow public read on portfolio_groups" ON portfolio_groups;
DROP POLICY IF EXISTS "Allow public insert on portfolio_groups" ON portfolio_groups;
DROP POLICY IF EXISTS "Allow public update on portfolio_groups" ON portfolio_groups;
DROP POLICY IF EXISTS "Allow public delete on portfolio_groups" ON portfolio_groups;
DROP POLICY IF EXISTS "portfolio_groups_select_own" ON portfolio_groups;
DROP POLICY IF EXISTS "portfolio_groups_insert_own" ON portfolio_groups;
DROP POLICY IF EXISTS "portfolio_groups_update_own" ON portfolio_groups;
DROP POLICY IF EXISTS "portfolio_groups_delete_own" ON portfolio_groups;

CREATE POLICY "portfolio_groups_select_own" ON portfolio_groups
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "portfolio_groups_insert_own" ON portfolio_groups
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "portfolio_groups_update_own" ON portfolio_groups
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "portfolio_groups_delete_own" ON portfolio_groups
  FOR DELETE USING (user_id = auth.uid());

-- 8. RLS Policies for portfolio_patents (with ownership check)
DROP POLICY IF EXISTS "Allow public read on portfolio_patents" ON portfolio_patents;
DROP POLICY IF EXISTS "Allow public insert on portfolio_patents" ON portfolio_patents;
DROP POLICY IF EXISTS "Allow public delete on portfolio_patents" ON portfolio_patents;
DROP POLICY IF EXISTS "portfolio_patents_select_own" ON portfolio_patents;
DROP POLICY IF EXISTS "portfolio_patents_insert_own" ON portfolio_patents;
DROP POLICY IF EXISTS "portfolio_patents_delete_own" ON portfolio_patents;

CREATE POLICY "portfolio_patents_select_own" ON portfolio_patents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "portfolio_patents_insert_own" ON portfolio_patents
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM portfolio_groups pg
      WHERE pg.id = portfolio_id AND pg.user_id = auth.uid()
    )
  );

CREATE POLICY "portfolio_patents_delete_own" ON portfolio_patents
  FOR DELETE USING (user_id = auth.uid());

-- 9. Saved searches table for user preferences
CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  query text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_searches_select_own" ON saved_searches
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "saved_searches_insert_own" ON saved_searches
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_searches_update_own" ON saved_searches
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_searches_delete_own" ON saved_searches
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id, created_at DESC);

-- 10. User preferences table for app settings
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid(),
  default_sort text DEFAULT 'relevance',
  default_date_filter text DEFAULT 'all',
  keyboard_shortcuts_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select_own" ON user_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_preferences_insert_own" ON user_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_preferences_update_own" ON user_preferences
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Done! Auth migration complete.
