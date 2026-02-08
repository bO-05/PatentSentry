-- ============================================================================
-- Security & Performance Fixes Migration
-- Addresses Supabase Advisor findings (SEC-1, SEC-2, SEC-3, SEC-4, PERF-1-24)
-- 
-- VERIFIED SAFE: All cache tables accessed via service_role (bypasses RLS)
-- ============================================================================

-- SEC-1: Fix mutable search_path on trigger function
-- Prevents search_path injection attacks
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
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

-- SEC-2/3: Remove UNUSED permissive anon INSERT/UPDATE on patent_analysis_cache
-- These policies are never used - cache writes happen via service_role
DROP POLICY IF EXISTS "Allow public insert on patent_analysis_cache" ON patent_analysis_cache;
DROP POLICY IF EXISTS "Allow public update on patent_analysis_cache" ON patent_analysis_cache;

-- SEC-4: Remove redundant policy on patent_enrichments
-- Service role bypasses RLS automatically, this policy is unnecessary
DROP POLICY IF EXISTS "Allow service role full access on patent_enrichments" ON patent_enrichments;

-- ============================================================================
-- PERFORMANCE: Wrap auth.uid() in (select ...) for O(1) evaluation
-- Prevents per-row re-evaluation of auth functions
-- ============================================================================

-- search_history
DROP POLICY IF EXISTS "search_history_select_own" ON search_history;
DROP POLICY IF EXISTS "search_history_insert_own" ON search_history;
DROP POLICY IF EXISTS "search_history_delete_own" ON search_history;

CREATE POLICY "search_history_select_own" ON search_history
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "search_history_insert_own" ON search_history
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "search_history_delete_own" ON search_history
  FOR DELETE USING (user_id = (select auth.uid()));

-- bookmarks
DROP POLICY IF EXISTS "bookmarks_select_own" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_insert_own" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_delete_own" ON bookmarks;

CREATE POLICY "bookmarks_select_own" ON bookmarks
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "bookmarks_insert_own" ON bookmarks
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "bookmarks_delete_own" ON bookmarks
  FOR DELETE USING (user_id = (select auth.uid()));

-- watched_patents
DROP POLICY IF EXISTS "watched_select_own" ON watched_patents;
DROP POLICY IF EXISTS "watched_insert_own" ON watched_patents;
DROP POLICY IF EXISTS "watched_update_own" ON watched_patents;
DROP POLICY IF EXISTS "watched_delete_own" ON watched_patents;

CREATE POLICY "watched_select_own" ON watched_patents
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "watched_insert_own" ON watched_patents
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "watched_update_own" ON watched_patents
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "watched_delete_own" ON watched_patents
  FOR DELETE USING (user_id = (select auth.uid()));

-- portfolio_groups
DROP POLICY IF EXISTS "portfolio_groups_select_own" ON portfolio_groups;
DROP POLICY IF EXISTS "portfolio_groups_insert_own" ON portfolio_groups;
DROP POLICY IF EXISTS "portfolio_groups_update_own" ON portfolio_groups;
DROP POLICY IF EXISTS "portfolio_groups_delete_own" ON portfolio_groups;

CREATE POLICY "portfolio_groups_select_own" ON portfolio_groups
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "portfolio_groups_insert_own" ON portfolio_groups
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "portfolio_groups_update_own" ON portfolio_groups
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "portfolio_groups_delete_own" ON portfolio_groups
  FOR DELETE USING (user_id = (select auth.uid()));

-- portfolio_patents
DROP POLICY IF EXISTS "portfolio_patents_select_own" ON portfolio_patents;
DROP POLICY IF EXISTS "portfolio_patents_insert_own" ON portfolio_patents;
DROP POLICY IF EXISTS "portfolio_patents_delete_own" ON portfolio_patents;

CREATE POLICY "portfolio_patents_select_own" ON portfolio_patents
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "portfolio_patents_insert_own" ON portfolio_patents
  FOR INSERT WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM portfolio_groups pg
      WHERE pg.id = portfolio_id AND pg.user_id = (select auth.uid())
    )
  );
CREATE POLICY "portfolio_patents_delete_own" ON portfolio_patents
  FOR DELETE USING (user_id = (select auth.uid()));

-- saved_searches
DROP POLICY IF EXISTS "saved_searches_select_own" ON saved_searches;
DROP POLICY IF EXISTS "saved_searches_insert_own" ON saved_searches;
DROP POLICY IF EXISTS "saved_searches_update_own" ON saved_searches;
DROP POLICY IF EXISTS "saved_searches_delete_own" ON saved_searches;

CREATE POLICY "saved_searches_select_own" ON saved_searches
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "saved_searches_insert_own" ON saved_searches
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "saved_searches_update_own" ON saved_searches
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "saved_searches_delete_own" ON saved_searches
  FOR DELETE USING (user_id = (select auth.uid()));

-- user_preferences
DROP POLICY IF EXISTS "user_preferences_select_own" ON user_preferences;
DROP POLICY IF EXISTS "user_preferences_insert_own" ON user_preferences;
DROP POLICY IF EXISTS "user_preferences_update_own" ON user_preferences;

CREATE POLICY "user_preferences_select_own" ON user_preferences
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "user_preferences_insert_own" ON user_preferences
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "user_preferences_update_own" ON user_preferences
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
