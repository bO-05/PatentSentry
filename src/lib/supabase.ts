import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export class AuthRequiredError extends Error {
  constructor(message = 'Sign in required') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export async function requireAuth(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new AuthRequiredError();
  }
  return user.id;
}

export interface SearchHistoryEntry {
  id?: string;
  query: string;
  patent_id: string | null;
  searched_at?: string;
}

const LOCAL_HISTORY_KEY = 'pt_local_search_history';
const MAX_LOCAL_HISTORY = 20;

interface LocalHistoryEntry {
  id: string;
  query: string;
  patent_id: string | null;
  searched_at: string;
}

function getLocalHistory(): LocalHistoryEntry[] {
  try {
    const stored = localStorage.getItem(LOCAL_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(entries: LocalHistoryEntry[]): void {
  try {
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_LOCAL_HISTORY)));
  } catch {
    // Ignore storage errors
  }
}

export async function saveSearchHistory(query: string, patentId: string | null = null) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    const entry: LocalHistoryEntry = {
      id: crypto.randomUUID(),
      query,
      patent_id: patentId,
      searched_at: new Date().toISOString(),
    };
    const history = getLocalHistory();
    history.unshift(entry);
    saveLocalHistory(history);
    return entry;
  }

  const { data, error } = await supabase
    .from('search_history')
    .insert([
      {
        query,
        patent_id: patentId,
        searched_at: new Date().toISOString()
      }
    ])
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error saving search history:', error);
    return null;
  }

  return data;
}

export async function getSearchHistory(limit = 10): Promise<SearchHistoryEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return getLocalHistory().slice(0, limit);
  }

  const { data, error } = await supabase
    .from('search_history')
    .select('*')
    .order('searched_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching search history:', error);
    return [];
  }

  return data;
}

export async function deleteSearchHistoryEntry(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    const history = getLocalHistory().filter(e => e.id !== id);
    saveLocalHistory(history);
    return true;
  }

  const { error } = await supabase
    .from('search_history')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting search history entry:', error);
    return false;
  }

  return true;
}

export interface Bookmark {
  id?: string;
  patent_id: string;
  patent_title: string | null;
  patent_date: string | null;
  created_at?: string;
}

export async function addBookmark(patentId: string, title: string | null, date: string | null) {
  const { data, error } = await supabase
    .from('bookmarks')
    .insert([
      {
        patent_id: patentId,
        patent_title: title,
        patent_date: date
      }
    ])
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error adding bookmark:', error);
    return null;
  }

  return data;
}

export async function removeBookmark(patentId: string) {
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('patent_id', patentId);

  if (error) {
    console.error('Error removing bookmark:', error);
    return false;
  }

  return true;
}

export async function getBookmarks() {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching bookmarks:', error);
    return [];
  }

  return data;
}

export async function isBookmarked(patentId: string) {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('patent_id', patentId)
    .maybeSingle();

  if (error) {
    console.error('Error checking bookmark:', error);
    return false;
  }

  return data !== null;
}
