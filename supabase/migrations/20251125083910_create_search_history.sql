/*
  # Create Search History Table

  ## Overview
  This migration creates a table to store user search history for PatentSentry application.
  
  ## New Tables
  1. `search_history`
    - `id` (uuid, primary key) - Unique identifier for each search
    - `query` (text) - The search query text entered by the user
    - `patent_id` (text, nullable) - The patent ID if a specific patent was analyzed
    - `searched_at` (timestamptz) - Timestamp when the search was performed
  
  ## Security
  - Enable Row Level Security (RLS) on `search_history` table
  - Add policy to allow public read access for demonstration purposes
  - Add policy to allow public insert access for demonstration purposes
  
  ## Important Notes
  - This is a demonstration app without authentication
  - In production, RLS policies should restrict access to authenticated users only
  - Data retention policy should be implemented for privacy compliance
*/

CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  patent_id text,
  searched_at timestamptz DEFAULT now()
);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON search_history
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access"
  ON search_history
  FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_search_history_searched_at 
  ON search_history(searched_at DESC);
