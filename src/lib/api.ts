// Support both Supabase Edge Functions (production) and local FastAPI backend (development)
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/patent-search`;

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

let authToken: string | null = null;

export function setApiAuthToken(token: string | null): void {
  authToken = token;
}

// Import supabase lazily to avoid circular dependency
async function getSupabaseSession(): Promise<string | null> {
  try {
    const { supabase } = await import('./supabase');
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function buildHeaders(useAuth: boolean = false): Promise<Record<string, string>> {
  console.log('[API Auth] buildHeaders called, useAuth:', useAuth, 'cachedToken:', authToken ? 'PRESENT' : 'NULL');

  // For public endpoints (search, analyze), always use anon key
  // For user-specific endpoints (watchlist, portfolio), fetch fresh session token
  let token = ANON_KEY;

  if (useAuth) {
    // Always fetch fresh session to avoid stale token issues after login
    const freshToken = await getSupabaseSession();
    console.log('[API Auth] freshToken from getSession:', freshToken ? 'GOT_TOKEN' : 'NO_TOKEN');
    token = freshToken ?? authToken ?? ANON_KEY;
    console.log('[API Auth] Final token decision:', token === ANON_KEY ? 'USING_ANON' : 'USING_USER_TOKEN');
  }

  return {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${token}`,
  };
}

// Request timeout configuration
// AI operations use 60s to accommodate 3-step Gemini pipeline
const TIMEOUTS = {
  search: 15000,
  analyze: 60000,  // 60s for 3-step AI pipeline (Extract → Analyze → Synthesize)
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
 * Transform API errors into user-friendly messages
 */
function getUserFriendlyError(status: number, errorBody: string): string {
  // Parse error body if JSON
  let parsed: { error?: string; suggestion?: string; patent_id?: string } = {};
  try {
    parsed = JSON.parse(errorBody);
  } catch {
    // Not JSON, use raw text
  }

  switch (status) {
    case 401:
      return 'Sign in required. Please log in to access this feature.';
    case 403:
      return 'Access denied. You may not have permission for this action.';
    case 404:
      // Check if this is a patent not found error
      if (parsed.error?.includes('Patent not found') || parsed.error?.includes('not found')) {
        const patentId = parsed.patent_id || 'this patent';
        return `Patent not found: ${patentId}. This might be a patent application (not yet granted) or the number may be incorrect. Only granted US patents are available.`;
      }
      return 'Not found. The requested resource does not exist.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
    case 502:
    case 503:
      return 'Server error. Our systems are experiencing issues. Please try again in a few moments.';
    default:
      // If we have a parsed error message, show it nicely
      if (parsed.error) {
        return parsed.error;
      }
      return `Request failed (${status}). Please try again.`;
  }
}

/**
 * Core API call with timeout, cancellation, and user-friendly error handling
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
    const headers = await buildHeaders(useAuth);
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(getUserFriendlyError(response.status, errorBody));
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. The server is taking too long to respond. Please try again.');
      }
      // Network errors
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('Connection failed. Please check your internet and try again.');
      }
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
        }).catch(() => { });
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
  getPatentEnrichment(patentId, patentTitle, assignee, false).catch(() => { });
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
          }).catch(() => { });
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

// ============================================================================
// Gemini 3 AI Analysis - Patent Intelligence
// ============================================================================

export interface AIAnalysisResult {
  patent_id: string;
  analysis_type: 'full';
  powered_by: 'Gemini 3';
  claims_summary: string;
  technical_scope: string;
  key_innovations: string[];
  potential_applications: string[];
  fto_considerations: string;
  competitive_landscape: string;
  generated_at: string;
  available?: boolean;
  reason?: string;
  error?: string;
}

// Cache for AI analysis results (longer TTL since AI analysis is expensive)
const aiAnalysisCache = new Map<string, { data: AIAnalysisResult; timestamp: number }>();
const pendingAIAnalysis = new Map<string, Promise<AIAnalysisResult>>();
const AI_ANALYSIS_CACHE_TTL = 600000; // 10 minutes

/**
 * Get AI-powered patent analysis using Gemini 3
 * On-demand analysis with caching and request deduplication
 */
export async function getAIPatentAnalysis(
  patentId: string,
  patentTitle: string,
  patentAbstract: string,
  options?: {
    assignee?: string;
    filingDate?: string;
    expirationDate?: string;
    forceRefresh?: boolean;
  }
): Promise<AIAnalysisResult> {
  const cacheKey = `ai:${patentId}`;

  // Check cache first (unless force refresh)
  if (!options?.forceRefresh) {
    const cached = aiAnalysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < AI_ANALYSIS_CACHE_TTL) {
      return cached.data;
    }

    // Check for pending request (deduplication)
    const pending = pendingAIAnalysis.get(cacheKey);
    if (pending) {
      return pending;
    }
  }

  // Make API call with extended timeout for AI processing
  const fetchPromise = apiCall<AIAnalysisResult>(
    {
      action: 'ai_analyze',
      patent_id: patentId,
      patent_title: patentTitle,
      patent_abstract: patentAbstract,
      assignee: options?.assignee,
      filing_date: options?.filingDate,
      expiration_date: options?.expirationDate,
    },
    {
      timeoutKey: 'analyze', // Uses 20s timeout
      cancellationKey: `ai_analyze:${patentId}`,
    }
  ).then(data => {
    // Only cache successful responses (not errors or unavailable states)
    if (data.available !== false) {
      aiAnalysisCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    pendingAIAnalysis.delete(cacheKey);
    return data;
  }).catch(err => {
    pendingAIAnalysis.delete(cacheKey);
    throw err;
  });

  pendingAIAnalysis.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Prefetch AI analysis on hover - improves perceived speed
 * Triggers background fetch so data is cached when user clicks
 * Fire-and-forget: doesn't block or throw
 */
export function prefetchAIAnalysis(
  patentId: string,
  patentTitle: string,
  patentAbstract: string,
  options?: {
    assignee?: string;
    filingDate?: string;
    expirationDate?: string;
  }
): void {
  const cacheKey = `ai:${patentId}`;

  // Skip if already cached or pending
  const cached = aiAnalysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < AI_ANALYSIS_CACHE_TTL) {
    return;
  }
  if (pendingAIAnalysis.has(cacheKey)) {
    return;
  }

  // Fire-and-forget prefetch
  getAIPatentAnalysis(patentId, patentTitle, patentAbstract, options)
    .catch(() => {
      // Silently ignore prefetch errors
    });
}

// ============================================================
// AI Patent Comparison - Multi-step AI orchestration
// ============================================================

export interface AICompareResult {
  comparison_type: "multi_patent";
  powered_by: "Gemini 3";
  patent_ids: string[];
  overlap_analysis: string;
  differentiation_matrix: Array<{
    patent_id: string;
    unique_aspects: string[];
    shared_with: string[];
  }>;
  fto_summary: string;
  recommendation: string;
  generated_at: string;
  available?: boolean;
  reason?: string;
  error?: string;
}

// Cache for AI comparison results
const aiCompareCache = new Map<string, { data: AICompareResult; timestamp: number }>();
const pendingAICompare = new Map<string, Promise<AICompareResult>>();
const AI_COMPARE_CACHE_TTL = 600000; // 10 minutes

/**
 * Get AI-powered patent comparison using Gemini 3
 * Compares multiple patents for overlaps, differences, and FTO implications
 */
export async function getAIPatentComparison(
  patents: Array<{
    patent_id: string;
    patent_title: string;
    patent_abstract: string;
    assignee?: string;
  }>
): Promise<AICompareResult> {
  // Create deterministic cache key from sorted patent IDs
  const sortedIds = patents.map(p => p.patent_id).sort();
  const cacheKey = `compare:${sortedIds.join(":")}`;

  // Check cache
  const cached = aiCompareCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < AI_COMPARE_CACHE_TTL) {
    return cached.data;
  }

  // Check for pending request (deduplication)
  const pending = pendingAICompare.get(cacheKey);
  if (pending) {
    return pending;
  }

  // Make API call
  const fetchPromise = apiCall<AICompareResult>(
    {
      action: 'ai_compare',
      patents,
    },
    {
      timeoutKey: 'analyze', // Uses 60s timeout for AI operations
      cancellationKey: `ai_compare:${cacheKey}`,
    }
  ).then(data => {
    // Only cache successful responses
    if (data.available !== false) {
      aiCompareCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    pendingAICompare.delete(cacheKey);
    return data;
  }).catch(err => {
    pendingAICompare.delete(cacheKey);
    throw err;
  });

  pendingAICompare.set(cacheKey, fetchPromise);
  return fetchPromise;
}

// ============================================================
// AI Query Expansion - Expand search queries for better discovery
// ============================================================

export interface QueryExpandResult {
  original_query: string;
  expanded_terms: string[];
  technical_synonyms: string[];
  suggested_cpc_codes: string[];
  reasoning: string;
  generated_at: string;
}

// Cache for query expansion results (shorter TTL)
const queryExpandCache = new Map<string, { data: QueryExpandResult; timestamp: number }>();
const QUERY_EXPAND_CACHE_TTL = 300000; // 5 minutes

/**
 * Expand search query using Gemini 3 for better patent discovery
 * Returns technical synonyms, related terms, and CPC codes
 */
export async function expandSearchQuery(query: string): Promise<QueryExpandResult> {
  const normalizedQuery = query.toLowerCase().trim();
  const cacheKey = `expand:${normalizedQuery}`;

  // Check cache
  const cached = queryExpandCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < QUERY_EXPAND_CACHE_TTL) {
    return cached.data;
  }

  // Make API call with search timeout (AI expansion shouldn't block search)
  const data = await apiCall<QueryExpandResult>(
    {
      action: 'query_expand',
      query,
    },
    {
      timeoutKey: 'search', // Uses 15s timeout
    }
  );

  queryExpandCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

// ============================================================
// AI Claim Graph - Patent claim dependency visualization
// ============================================================

export interface ClaimGraphResult {
  patent_id: string;
  powered_by: "Gemini 3";
  claims: Array<{
    claim_id: number;
    type: "independent" | "dependent";
    depends_on: number[];
    essence: string;
    key_elements: string[];
  }>;
  generated_at: string;
  available?: boolean;
  reason?: string;
  error?: string;
}

const claimGraphCache = new Map<string, { data: ClaimGraphResult; timestamp: number }>();
const pendingClaimGraph = new Map<string, Promise<ClaimGraphResult>>();
const CLAIM_GRAPH_CACHE_TTL = 600000; // 10 minutes

export async function getClaimGraph(
  patentId: string,
  patentTitle: string,
  patentAbstract: string,
  claimsText?: string
): Promise<ClaimGraphResult> {
  const cacheKey = `claimgraph:${patentId}`;

  // Check cache
  const cached = claimGraphCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CLAIM_GRAPH_CACHE_TTL) {
    return cached.data;
  }

  // Check for pending request (deduplication)
  const pending = pendingClaimGraph.get(cacheKey);
  if (pending) {
    return pending;
  }

  const fetchPromise = apiCall<ClaimGraphResult>(
    {
      action: 'ai_claim_graph',
      patent_id: patentId,
      patent_title: patentTitle,
      patent_abstract: patentAbstract,
      claims_text: claimsText,
    },
    {
      timeoutKey: 'analyze',
      cancellationKey: `claim_graph:${patentId}`,
    }
  ).then(data => {
    // Only cache successful responses (not errors or unavailable states)
    if (data.available !== false) {
      claimGraphCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    pendingClaimGraph.delete(cacheKey);
    return data;
  }).catch(err => {
    pendingClaimGraph.delete(cacheKey);
    throw err;
  });

  pendingClaimGraph.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export function prefetchClaimGraph(
  patentId: string,
  patentTitle: string,
  patentAbstract: string,
  claimsText?: string
): void {
  const cacheKey = `claimgraph:${patentId}`;

  const cached = claimGraphCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CLAIM_GRAPH_CACHE_TTL) {
    return;
  }
  if (pendingClaimGraph.has(cacheKey)) {
    return;
  }

  getClaimGraph(patentId, patentTitle, patentAbstract, claimsText)
    .catch(() => {
      // Silently ignore prefetch errors
    });
}

// ============================================================
// Inventor Network - Collaboration graph analysis
// ============================================================

export interface InventorNetworkResult {
  nodes: Array<{
    id: string;
    name: string;
    patent_count: number;
    primary_assignee?: string;
    expertise_areas: string[];
  }>;
  edges: Array<{
    source: string;
    target: string;
    weight: number;
    patents: string[];
  }>;
  clusters: Array<{
    id: string;
    inventors: string[];
    common_assignee?: string;
    focus_area: string;
  }>;
  stats: {
    total_inventors: number;
    total_collaborations: number;
    most_connected_inventor: string;
  };
  available?: boolean;
  error?: string;
}

const inventorNetworkCache = new Map<string, { data: InventorNetworkResult; timestamp: number }>();
const pendingInventorNetwork = new Map<string, Promise<InventorNetworkResult>>();
const INVENTOR_NETWORK_CACHE_TTL = 600000; // 10 minutes

export async function getInventorNetwork(options: {
  inventorName?: string;
  assignee?: string;
  patentIds?: string[];
  limit?: number;
}): Promise<InventorNetworkResult> {
  const keyParts = [
    options.inventorName || '',
    options.assignee || '',
    (options.patentIds || []).sort().join(','),
    String(options.limit || 50),
  ];
  const cacheKey = `inventor_network:${keyParts.join(':')}`;

  const cached = inventorNetworkCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < INVENTOR_NETWORK_CACHE_TTL) {
    return cached.data;
  }

  const pending = pendingInventorNetwork.get(cacheKey);
  if (pending) {
    return pending;
  }

  const fetchPromise = apiCall<InventorNetworkResult>(
    {
      action: 'inventor_network',
      inventor_name: options.inventorName,
      assignee: options.assignee,
      patent_ids: options.patentIds,
      limit: options.limit,
    },
    {
      timeoutKey: 'analyze',
      cancellationKey: `inventor_network:${cacheKey}`,
    }
  ).then(data => {
    // Only cache successful responses
    if (data.available !== false) {
      inventorNetworkCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    pendingInventorNetwork.delete(cacheKey);
    return data;
  }).catch(err => {
    pendingInventorNetwork.delete(cacheKey);
    throw err;
  });

  pendingInventorNetwork.set(cacheKey, fetchPromise);
  return fetchPromise;
}

// ============================================================
// AI FTO Risk Analysis - Freedom to Operate Analysis
// ============================================================

export interface FTOAnalysisResult {
  powered_by: "Gemini 3";
  product_summary: string;
  overall_risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  patent_risks: Array<{
    patent_id: string;
    risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    overlapping_elements: string[];
    non_overlapping_elements: string[];
    design_around_suggestions: string[];
    confidence: number;
  }>;
  strategic_recommendations: string[];
  generated_at: string;
  available?: boolean;
  error?: string;
}

const ftoAnalysisCache = new Map<string, { data: FTOAnalysisResult; timestamp: number }>();
const pendingFTOAnalysis = new Map<string, Promise<FTOAnalysisResult>>();
const FTO_ANALYSIS_CACHE_TTL = 600000; // 10 minutes

export async function analyzeFTORisk(
  productDescription: string,
  patents: Array<{ patent_id: string; patent_title: string; patent_abstract: string; claims_text?: string }>
): Promise<FTOAnalysisResult> {
  const sortedIds = patents.map(p => p.patent_id).sort();
  const descHash = productDescription.slice(0, 100).replace(/\s+/g, '_');
  const cacheKey = `fto:${descHash}:${sortedIds.join(":")}`;

  const cached = ftoAnalysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FTO_ANALYSIS_CACHE_TTL) {
    return cached.data;
  }

  const pending = pendingFTOAnalysis.get(cacheKey);
  if (pending) {
    return pending;
  }

  const fetchPromise = apiCall<FTOAnalysisResult>(
    {
      action: 'ai_fto_analyze',
      product_description: productDescription,
      patents,
    },
    {
      timeoutKey: 'analyze',
      cancellationKey: `fto_analysis:${cacheKey}`,
    }
  ).then(data => {
    // Only cache successful responses
    if (data.available !== false) {
      ftoAnalysisCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    pendingFTOAnalysis.delete(cacheKey);
    return data;
  }).catch(err => {
    pendingFTOAnalysis.delete(cacheKey);
    throw err;
  });

  pendingFTOAnalysis.set(cacheKey, fetchPromise);
  return fetchPromise;
}

// ============================================================
// AI Prior Art Discovery - Find prior art for a patent
// ============================================================

export interface PriorArtResult {
  powered_by: "Gemini 3";
  target_patent: string;
  key_concepts: string[];
  search_strategy: { keywords: string[]; cpc_codes: string[]; date_range: { before: string } };
  prior_art_candidates: Array<{
    patent_id: string;
    patent_title: string;
    relevance_score: number;
    overlap_summary: string;
    key_matching_elements: string[];
  }>;
  analysis_summary: string;
  generated_at: string;
  available?: boolean;
  error?: string;
}

const priorArtCache = new Map<string, { data: PriorArtResult; timestamp: number }>();
const pendingPriorArt = new Map<string, Promise<PriorArtResult>>();
const PRIOR_ART_CACHE_TTL = 600000; // 10 minutes

export async function discoverPriorArt(
  patentId: string,
  patentTitle: string,
  patentAbstract: string,
  filingDate?: string,
  claimsText?: string
): Promise<PriorArtResult> {
  const cacheKey = `prior_art:${patentId}`;

  const cached = priorArtCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < PRIOR_ART_CACHE_TTL) {
    return cached.data;
  }

  const pending = pendingPriorArt.get(cacheKey);
  if (pending) {
    return pending;
  }

  const fetchPromise = apiCall<PriorArtResult>(
    {
      action: 'ai_prior_art',
      patent_id: patentId,
      patent_title: patentTitle,
      patent_abstract: patentAbstract,
      filing_date: filingDate,
      claims_text: claimsText,
    },
    {
      timeoutKey: 'analyze',
      cancellationKey: `prior_art:${patentId}`,
    }
  ).then(data => {
    // Only cache successful responses (not errors or unavailable states)
    if (data.available !== false) {
      priorArtCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    pendingPriorArt.delete(cacheKey);
    return data;
  }).catch(err => {
    pendingPriorArt.delete(cacheKey);
    throw err;
  });

  pendingPriorArt.set(cacheKey, fetchPromise);
  return fetchPromise;
}

// ============================================================
// Portfolio Valuation - AI-powered patent portfolio scoring
// ============================================================

export interface PortfolioValueResult {
  powered_by: "Gemini 3";
  portfolio_summary: {
    total_patents: number;
    average_score: number;
    highest_value_patent: string;
    portfolio_strength: "WEAK" | "MODERATE" | "STRONG" | "EXCEPTIONAL";
  };
  patent_scores: Array<{
    patent_id: string;
    overall_score: number;
    innovation_score: number;
    market_relevance_score: number;
    remaining_life_score: number;
    claim_breadth_score: number;
    value_drivers: string[];
    risks: string[];
  }>;
  strategic_insights: string[];
  generated_at: string;
  available?: boolean;
  error?: string;
}

const portfolioValueCache = new Map<string, { data: PortfolioValueResult; timestamp: number }>();
const pendingPortfolioValue = new Map<string, Promise<PortfolioValueResult>>();
const PORTFOLIO_VALUE_CACHE_TTL = 600000; // 10 minutes

export async function getPortfolioValuation(
  patents: Array<{
    patent_id: string;
    patent_title: string;
    patent_abstract: string;
    filing_date?: string;
    expiration_date?: string;
    assignee?: string;
    citation_count?: number;
  }>
): Promise<PortfolioValueResult> {
  const sortedIds = patents.map(p => p.patent_id).sort();
  const cacheKey = `portfolio_value:${sortedIds.join(":")}`;

  const cached = portfolioValueCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < PORTFOLIO_VALUE_CACHE_TTL) {
    return cached.data;
  }

  const pending = pendingPortfolioValue.get(cacheKey);
  if (pending) {
    return pending;
  }

  const fetchPromise = apiCall<PortfolioValueResult>(
    {
      action: 'ai_portfolio_value',
      patents,
    },
    {
      timeoutKey: 'analyze',
      cancellationKey: `portfolio_valuation:${cacheKey}`,
    }
  ).then(data => {
    // Only cache successful responses
    if (data.available !== false) {
      portfolioValueCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    pendingPortfolioValue.delete(cacheKey);
    return data;
  }).catch(err => {
    pendingPortfolioValue.delete(cacheKey);
    throw err;
  });

  pendingPortfolioValue.set(cacheKey, fetchPromise);
  return fetchPromise;
}

// ============================================================
// Patent Landscape Analysis - Market overview and competitive landscape
// ============================================================

export interface LandscapeResult {
  powered_by: "Gemini 3";
  query: string;
  analysis_date: string;
  market_overview: string;
  top_assignees: Array<{
    name: string;
    patent_count: number;
    focus_areas: string[];
    trend: "growing" | "stable" | "declining";
  }>;
  technology_clusters: Array<{
    name: string;
    description: string;
    key_patents: string[];
    maturity: "emerging" | "growing" | "mature" | "declining";
  }>;
  filing_trends: {
    overall_trend: "increasing" | "stable" | "decreasing";
    peak_year?: string;
    insight: string;
  };
  white_space_opportunities: string[];
  key_takeaways: string[];
  generated_at: string;
  available?: boolean;
  error?: string;
}

const landscapeCache = new Map<string, { data: LandscapeResult; timestamp: number }>();
const pendingLandscape = new Map<string, Promise<LandscapeResult>>();
const LANDSCAPE_CACHE_TTL = 600000; // 10 minutes

export async function analyzeLandscape(
  query: string,
  patents: Array<{ patent_id: string; patent_title: string; patent_abstract: string; assignee?: string; filing_date?: string }>
): Promise<LandscapeResult> {
  const sortedIds = patents.map(p => p.patent_id).sort();
  const queryHash = query.slice(0, 50).replace(/\s+/g, '_');
  const cacheKey = `landscape:${queryHash}:${sortedIds.join(":")}`;

  const cached = landscapeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LANDSCAPE_CACHE_TTL) {
    return cached.data;
  }

  const pending = pendingLandscape.get(cacheKey);
  if (pending) {
    return pending;
  }

  const fetchPromise = apiCall<LandscapeResult>(
    {
      action: 'ai_landscape',
      query,
      patents,
    },
    {
      timeoutKey: 'analyze',
      cancellationKey: `landscape_analysis:${cacheKey}`,
    }
  ).then(data => {
    // Only cache successful responses
    if (data.available !== false) {
      landscapeCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    pendingLandscape.delete(cacheKey);
    return data;
  }).catch(err => {
    pendingLandscape.delete(cacheKey);
    throw err;
  });

  pendingLandscape.set(cacheKey, fetchPromise);
  return fetchPromise;
}

// ============================================================
// Firecrawl Patent Content Scraping
// ============================================================

export interface FirecrawlResult {
  success: boolean;
  patent_id: string;
  markdown?: string;
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
  };
  fetched_at?: string;
  available?: boolean;
  error?: string;
}

const firecrawlCache = new Map<string, { data: FirecrawlResult; timestamp: number }>();
const pendingFirecrawl = new Map<string, Promise<FirecrawlResult>>();
const FIRECRAWL_CACHE_TTL = 3600000; // 1 hour (patent content is stable)

/**
 * Get full patent content via Firecrawl markdown scraping
 * Uses 8-key round-robin rotation on backend for rate limit bypass
 */
export async function getPatentContent(patentId: string): Promise<FirecrawlResult> {
  const cacheKey = `firecrawl:${patentId}`;

  // Check cache
  const cached = firecrawlCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FIRECRAWL_CACHE_TTL) {
    return { ...cached.data, from_cache: true } as FirecrawlResult & { from_cache: boolean };
  }

  // Check for pending request
  const pending = pendingFirecrawl.get(cacheKey);
  if (pending) {
    return pending;
  }

  const fetchPromise = apiCall<FirecrawlResult>(
    {
      action: 'firecrawl_scrape',
      patent_id: patentId,
    },
    {
      timeoutKey: 'analyze', // Longer timeout for scraping
      cancellationKey: `firecrawl:${patentId}`,
    }
  ).then(data => {
    // Only cache successful responses
    if (data.success && data.available !== false) {
      firecrawlCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    pendingFirecrawl.delete(cacheKey);
    return data;
  }).catch(err => {
    pendingFirecrawl.delete(cacheKey);
    throw err;
  });

  pendingFirecrawl.set(cacheKey, fetchPromise);
  return fetchPromise;
}
