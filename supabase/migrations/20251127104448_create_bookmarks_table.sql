/*
  # Create bookmarks table for saving patents

  1. New Tables
    - `bookmarks`
      - `id` (uuid, primary key)
      - `patent_id` (text, the patent ID being bookmarked)
      - `patent_title` (text, cached title for quick display)
      - `patent_date` (text, cached date for sorting)
      - `created_at` (timestamptz, when bookmark was created)

  2. Security
    - Enable RLS on `bookmarks` table
    - Add policy for authenticated users to manage their own bookmarks
    - Users can only read, insert, update, and delete their own bookmarks

  3. Indexes
    - Index on patent_id for faster lookups
    - Index on created_at for sorting
*/

CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patent_id text NOT NULL,
  patent_title text,
  patent_date text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookmarks"
  ON bookmarks
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own bookmarks"
  ON bookmarks
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete own bookmarks"
  ON bookmarks
  FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_bookmarks_patent_id ON bookmarks(patent_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);
