// Support both Supabase Edge Functions (production) and local FastAPI backend (development)
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/patent-search`;

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

let authToken: string | null = null;

export function setApiAuthToken(token: string | null): void {
  authToken = token;
}

function buildHeaders(useAuth: boolean = false): Record<string, string> {
  // For public endpoints (search, analyze), always use anon key
  // For user-specific endpoints (watchlist, portfolio), use user JWT if available
  const token = useAuth && authToken ? authToken : ANON_KEY;
  return {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${token}`,
  };
}

// Request timeout configuration
const TIMEOUTS = {
  search: 15000,
  analyze: 20000,
  enrich: 10000,
  default: 15000,
} as const;

// Active request controllers for cancellation
const activeControllers = new Map<string, AbortController>();

const prefetchCache = new Map<string, { data: unknown; timestamp: number }>();
const PREFETCH_CACHE_TTL = 60000;
const STALE_TTL = 300000;
const pendingPrefetches = new Map<string, Promise<unknown>>();

const analysisCache = new Map<string, { data: unknown; timestamp: number }>();
const searchCache = new Map<string, { data: unknown; timestamp: number }>();
const pendingSearches = new Map<string, Promise<unknown>>();
const SEARCH_CACHE_TTL = 120000;

const relatedCache = new Map<string, { data: unknown; timestamp: number }>();
const pendingRelated = new Map<string, Promise<unknown>>();
const RELATED_CACHE_TTL = 300000;

const enrichmentCache = new Map<string, { data: EnrichmentResult; timestamp: number }>();
const pendingEnrichments = new Map<string, Promise<EnrichmentResult>>();
const ENRICHMENT_CACHE_TTL = 300000;

export function clearUserCaches(): void {
  // Note: analysisCache, searchCache, enrichmentCache are patent data (public)
  // We don't clear them on auth change since they're not user-specific.
  // User-specific data (watchlist, bookmarks, portfolios) is fetched directly
  // from Supabase and RLS handles isolation.
  // Clear prefetch cache to avoid stale auth-dependent data
  prefetchCache.clear();
  pendingPrefetches.clear();
}

export type RefreshCallback = (data: unknown) => void;

type TimeoutKey = keyof typeof TIMEOUTS;

/**
 * Cancel any in-flight request with the given key
 */
function cancelRequest(key: string): void {
  const controller = activeControllers.get(key);
  if (controller) {
    controller.abort();
    activeControllers.delete(key);
  }
}

/**
 * Core API call with timeout, cancellation, and error handling
 */
async function apiCall<T>(
  body: Record<string, unknown>,
  options?: {
    timeoutKey?: TimeoutKey;
    cancellationKey?: string;
    useAuth?: boolean;
  }
): Promise<T> {
  const { timeoutKey = 'default', cancellationKey, useAuth = false } = options ?? {};
  const timeout = TIMEOUTS[timeoutKey];

  // Cancel previous request with same key if exists
  if (cancellationKey) {
    cancelRequest(cancellationKey);
  }

  const controller = new AbortController();
  if (cancellationKey) {
    activeControllers.set(cancellationKey, controller);
  }

  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: buildHeaders(useAuth),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API error: ${response.status} - ${errorBody}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (cancellationKey && activeControllers.get(cancellationKey) === controller) {
      activeControllers.delete(cancellationKey);
    }
  }
}

function cleanupPrefetchCache() {
  const now = Date.now();
  for (const [key, value] of prefetchCache.entries()) {
    if (now - value.timestamp > PREFETCH_CACHE_TTL) {
      prefetchCache.delete(key);
    }
  }
}

function cleanupCaches() {
  const now = Date.now();

  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > SEARCH_CACHE_TTL) {
      searchCache.delete(key);
    }
  }

  for (const [key, value] of relatedCache.entries()) {
    if (now - value.timestamp > RELATED_CACHE_TTL) {
      relatedCache.delete(key);
    }
  }

  for (const [key, value] of enrichmentCache.entries()) {
    if (now - value.timestamp > ENRICHMENT_CACHE_TTL) {
      enrichmentCache.delete(key);
    }
  }
}

if (!(globalThis as Record<string, unknown>).__ptCacheCleanupInterval) {
  (globalThis as Record<string, unknown>).__ptCacheCleanupInterval = setInterval(cleanupCaches, 60000);
}

export function prefetchPatentAnalysis(patentId: string): void {
  const cacheKey = `analyze:${patentId}`;

  if (prefetchCache.has(cacheKey)) return;
  if (pendingPrefetches.has(cacheKey)) return;

  const prefetchPromise = apiCall({
    action: 'analyze',
    patent_id: patentId,
  }).then(data => {
    prefetchCache.set(cacheKey, { data, timestamp: Date.now() });
    pendingPrefetches.delete(cacheKey);
    return data;
  }).catch(() => {
    pendingPrefetches.delete(cacheKey);
  });

  pendingPrefetches.set(cacheKey, prefetchPromise);

  cleanupPrefetchCache();
}

export function getPrefetchedAnalysis(patentId: string): unknown | null {
  const cacheKey = `analyze:${patentId}`;
  const cached = prefetchCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < PREFETCH_CACHE_TTL) {
    prefetchCache.delete(cacheKey);
    return cached.data;
  }

  return null;
}

export async function waitForPrefetch(patentId: string): Promise<unknown | null> {
  const cacheKey = `analyze:${patentId}`;
  const pending = pendingPrefetches.get(cacheKey);

  if (pending) {
    try {
      return await pending;
    } catch {
      return null;
    }
  }

  return getPrefetchedAnalysis(patentId);
}

export async function searchPatents(
  query: string,
  page: number = 1,
  sort: 'relevance' | 'date_desc' | 'date_asc' = 'relevance',
  perPage: number = 25
) {
  const cacheKey = `search:${query}:${page}:${sort}:${perPage}`;

  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    return cached.data;
  }

  const pending = pendingSearches.get(cacheKey);
  if (pending) {
    return pending;
  }

  const searchPromise = apiCall(
    {
      action: 'search',
      query,
      page,
      per_page: perPage,
      sort,
    },
    {
      timeoutKey: 'search',
      cancellationKey: 'search', // Cancel previous search when new one starts
    }
  ).then(data => {
    searchCache.set(cacheKey, { data, timestamp: Date.now() });
    pendingSearches.delete(cacheKey);
    return data;
  }).catch(err => {
    pendingSearches.delete(cacheKey);
    throw err;
  });

  pendingSearches.set(cacheKey, searchPromise);
  return searchPromise;
}

export async function analyzePatent(
  patentId: string,
  forceRefresh: boolean = false,
  onRefresh?: RefreshCallback
): Promise<unknown> {
  const cacheKey = `analysis:${patentId}`;
  const cached = analysisCache.get(cacheKey);
  const now = Date.now();

  if (cached && !forceRefresh) {
    const age = now - cached.timestamp;

    if (age < STALE_TTL) {
      if (age > PREFETCH_CACHE_TTL && onRefresh) {
        apiCall({
          action: 'analyze',
          patent_id: patentId,
          force_refresh: false,
        }).then(freshData => {
          analysisCache.set(cacheKey, { data: freshData, timestamp: Date.now() });
          onRefresh(freshData);
        }).catch(() => {});
      }
      return cached.data;
    }
  }

  const data = await apiCall({
    action: 'analyze',
    patent_id: patentId,
    force_refresh: forceRefresh,
  });

  analysisCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export async function bulkAnalyzePatents(patentIds: string[]) {
  return apiCall({
    action: 'bulk_analyze',
    patent_ids: patentIds,
  });
}

export async function getWatchlist() {
  return apiCall<{ watchlist: WatchedPatent[] }>(
    { action: 'get_watchlist' },
    { useAuth: true }
  );
}

export async function addToWatchlist(patentId: string, patentData: Record<string, unknown>) {
  return apiCall(
    {
      action: 'add_to_watchlist',
      patent_id: patentId,
      patent_data: patentData,
    },
    { useAuth: true }
  );
}

export async function removeFromWatchlist(patentId: string) {
  return apiCall(
    {
      action: 'remove_from_watchlist',
      patent_id: patentId,
    },
    { useAuth: true }
  );
}

export async function getExpiringSoon(daysThreshold: number = 90) {
  return apiCall<{ expiring_patents: WatchedPatent[]; upcoming_fees: UpcomingFee[] }>(
    {
      action: 'get_expiring_soon',
      days_threshold: daysThreshold,
    },
    { useAuth: true }
  );
}

export async function listPortfolios() {
  return apiCall<{ portfolios: Portfolio[] }>(
    { action: 'list_portfolios' },
    { useAuth: true }
  );
}

export async function createPortfolio(name: string, description?: string) {
  return apiCall(
    {
      action: 'create_portfolio',
      name,
      description,
    },
    { useAuth: true }
  );
}

export async function addToPortfolio(portfolioId: string, patentId: string, patentTitle?: string) {
  return apiCall(
    {
      action: 'add_to_portfolio',
      portfolio_id: portfolioId,
      patent_id: patentId,
      patent_title: patentTitle,
    },
    { useAuth: true }
  );
}

export async function getPortfolio(portfolioId: string) {
  return apiCall(
    {
      action: 'get_portfolio',
      portfolio_id: portfolioId,
    },
    { useAuth: true }
  );
}

export async function analyzePortfolio(portfolioId: string) {
  return apiCall(
    {
      action: 'analyze_portfolio',
      portfolio_id: portfolioId,
    },
    { useAuth: true }
  );
}

export interface WatchedPatent {
  id: string;
  patent_id: string;
  patent_title: string;
  filing_date: string;
  grant_date: string;
  expiration_date: string;
  pta_days: number;
  pte_days: number;
  assignee: string;
  notes: string;
  alert_90_days: boolean;
  alert_30_days: boolean;
  alert_fee_deadline: boolean;
  fee_3_5_year_date: string;
  fee_7_5_year_date: string;
  fee_11_5_year_date: string;
  created_at: string;
  updated_at: string;
}

export interface UpcomingFee {
  patent_id: string;
  patent_title: string;
  fee_type: string;
  due_date: string;
}

export interface Portfolio {
  id: string;
  name: string;
  description: string;
  created_at: string;
  portfolio_patents: { count: number }[];
}

export interface BulkAnalysisResult {
  results: Record<string, unknown>[];
  errors: { patent_id: string; error: string }[];
  summary: {
    total_requested: number;
    successful: number;
    failed: number;
    active_patents: number;
    expired_patents: number;
    expiring_soon: number;
  };
}

export interface EnrichmentArticle {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  source?: string;
}

export interface EnrichmentResult {
  patent_id: string;
  available: boolean;
  from_cache?: boolean;
  cached_at?: string;
  reason?: string;
  assignee?: string;
  company_news: EnrichmentArticle[];
  market_context: EnrichmentArticle[];
  product_mentions: EnrichmentArticle[];
}

export interface CitationPatent {
  patent_id: string;
  patent_title: string;
  patent_date: string;
  assignee?: string;
}

export interface CitationsResult {
  patent_id: string;
  cited_by: CitationPatent[];
  cited_by_count: number;
  cites: CitationPatent[];
  cites_count: number;
}

export interface AssigneePatent {
  patent_id: string;
  patent_title: string;
  patent_date: string;
  cpc_codes?: string[];
}

export interface AssigneePatentsResult {
  assignee: string;
  patents: AssigneePatent[];
  count: number;
}

/**
 * Prefetch enrichment data in the background (fire-and-forget)
 * Call this on hover/visibility to pre-warm the cache
 */
export function prefetchEnrichment(
  patentId: string,
  patentTitle?: string,
  assignee?: string
): void {
  const cacheKey = `enrich:${patentId}`;

  // Skip if already cached or in-flight
  if (enrichmentCache.has(cacheKey)) return;
  if (pendingEnrichments.has(cacheKey)) return;

  // Fire and forget - errors are silently ignored for prefetch
  getPatentEnrichment(patentId, patentTitle, assignee, false).catch(() => {});
}

export async function getPatentEnrichment(
  patentId: string,
  patentTitle?: string,
  assignee?: string,
  forceRefresh: boolean = false,
  onRefresh?: RefreshCallback
): Promise<EnrichmentResult> {
  const cacheKey = `enrich:${patentId}`;
  const now = Date.now();

  if (!forceRefresh) {
    const cached = enrichmentCache.get(cacheKey);

    if (cached) {
      const age = now - cached.timestamp;

      // Fresh cache: return immediately
      if (age < ENRICHMENT_CACHE_TTL) {
        // Stale-while-revalidate: refresh in background if stale
        if (age > ENRICHMENT_CACHE_TTL / 2 && onRefresh) {
          apiCall<EnrichmentResult>(
            {
              action: 'enrich',
              patent_id: patentId,
              patent_title: patentTitle,
              assignee: assignee,
              force_refresh: false,
            },
            { timeoutKey: 'enrich' }
          ).then(freshData => {
            enrichmentCache.set(cacheKey, { data: freshData, timestamp: Date.now() });
            onRefresh(freshData);
          }).catch(() => {});
        }
        return { ...cached.data, from_cache: true };
      }
    }

    const pending = pendingEnrichments.get(cacheKey);
    if (pending) {
      return pending;
    }
  }

  const fetchPromise = apiCall<EnrichmentResult>(
    {
      action: 'enrich',
      patent_id: patentId,
      patent_title: patentTitle,
      assignee: assignee,
      force_refresh: forceRefresh,
    },
    { timeoutKey: 'enrich' }
  ).then(data => {
    enrichmentCache.set(cacheKey, { data, timestamp: Date.now() });
    pendingEnrichments.delete(cacheKey);
    return data;
  }).catch(err => {
    pendingEnrichments.delete(cacheKey);
    throw err;
  });

  pendingEnrichments.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export async function getPatentCitations(patentId: string): Promise<CitationsResult> {
  const cacheKey = `citations:${patentId}`;

  const cached = relatedCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < RELATED_CACHE_TTL) {
    return cached.data as CitationsResult;
  }

  const pending = pendingRelated.get(cacheKey);
  if (pending) {
    return pending as Promise<CitationsResult>;
  }

  const fetchPromise = apiCall<CitationsResult>({
    action: 'citations',
    patent_id: patentId,
  }).then(data => {
    relatedCache.set(cacheKey, { data, timestamp: Date.now() });
    pendingRelated.delete(cacheKey);
    return data;
  }).catch(err => {
    pendingRelated.delete(cacheKey);
    throw err;
  });

  pendingRelated.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export async function getAssigneePatents(
  assignee: string,
  excludePatentId?: string,
  limit: number = 10
): Promise<AssigneePatentsResult> {
  const cacheKey = `assignee:${assignee}:${excludePatentId || ''}:${limit}`;

  const cached = relatedCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < RELATED_CACHE_TTL) {
    return cached.data as AssigneePatentsResult;
  }

  const pending = pendingRelated.get(cacheKey);
  if (pending) {
    return pending as Promise<AssigneePatentsResult>;
  }

  const fetchPromise = apiCall<AssigneePatentsResult>({
    action: 'assignee_patents',
    assignee,
    patent_id: excludePatentId,
    limit,
  }).then(data => {
    relatedCache.set(cacheKey, { data, timestamp: Date.now() });
    pendingRelated.delete(cacheKey);
    return data;
  }).catch(err => {
    pendingRelated.delete(cacheKey);
    throw err;
  });

  pendingRelated.set(cacheKey, fetchPromise);
  return fetchPromise;
}
