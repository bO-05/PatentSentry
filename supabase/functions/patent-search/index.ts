import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

function getUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Unauthorized: Missing Authorization header");
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

async function requireAuth(req: Request): Promise<{ userId: string; supabase: SupabaseClient }> {
  const authHeader = req.headers.get("Authorization");
  console.log("[Auth] requireAuth called, auth header present:", !!authHeader);

  if (!authHeader) {
    console.error("[Auth] No authorization header");
    throw new Error("Unauthorized: Missing Authorization header");
  }

  // Log first 20 chars of token for debugging (safe - not the full token)
  const tokenPreview = authHeader.slice(0, 50) + "...";
  console.log("[Auth] Token preview:", tokenPreview);

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  console.log("[Auth] getUser result - user:", user ? user.id : null, "error:", error?.message);

  if (error || !user) {
    console.error("[Auth] Auth failed:", error?.message || "No user returned");
    throw new Error("Unauthorized: Invalid or expired token");
  }

  return { userId: user.id, supabase: userClient };
}

interface SearchQuery {
  action: "search";
  query: string;
  page?: number;
  per_page?: number;
  sort?: "relevance" | "date_desc" | "date_asc";
}

interface AnalyzeQuery {
  action: "analyze";
  patent_id: string;
  url?: string;
  force_refresh?: boolean;
}

interface BulkAnalyzeQuery {
  action: "bulk_analyze";
  patent_ids: string[];
}

interface WatchlistQuery {
  action: "add_to_watchlist" | "remove_from_watchlist" | "get_watchlist" | "get_expiring_soon";
  patent_id?: string;
  patent_data?: Record<string, unknown>;
  days_threshold?: number;
}

interface PortfolioQuery {
  action: "create_portfolio" | "add_to_portfolio" | "get_portfolio" | "list_portfolios" | "analyze_portfolio";
  portfolio_id?: string;
  name?: string;
  description?: string;
  patent_id?: string;
  patent_title?: string;
}

interface EnrichQuery {
  action: "enrich";
  patent_id: string;
  patent_title?: string;
  assignee?: string;
  force_refresh?: boolean;
}

interface CitationsQuery {
  action: "citations";
  patent_id: string;
}

interface AssigneePatentsQuery {
  action: "assignee_patents";
  assignee: string;
  patent_id?: string;
  limit?: number;
}

interface AIAnalyzeQuery {
  action: "ai_analyze";
  patent_id: string;
  patent_title: string;
  patent_abstract: string;
  claims_text?: string;
  assignee?: string;
  filing_date?: string;
  expiration_date?: string;
}

// AI Patent Comparison - Multi-step orchestration for comparing multiple patents
interface AICompareQuery {
  action: "ai_compare";
  patents: Array<{
    patent_id: string;
    patent_title: string;
    patent_abstract: string;
    assignee?: string;
  }>;
}

interface AICompareResult {
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
}

// AI Query Expansion - Expand user search queries for better patent discovery
interface QueryExpandQuery {
  action: "query_expand";
  query: string;
}

// AI Claim Graph - Parse patent claims and identify dependencies
interface ClaimGraphQuery {
  action: "ai_claim_graph";
  patent_id: string;
  patent_title: string;
  patent_abstract: string;
  claims_text?: string;
}

interface ClaimGraphResult {
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
}

// AI Portfolio Valuation - Score patents by strategic value
interface PortfolioValueQuery {
  action: "ai_portfolio_value";
  patents: Array<{
    patent_id: string;
    patent_title: string;
    patent_abstract: string;
    filing_date?: string;
    expiration_date?: string;
    assignee?: string;
    citation_count?: number;
  }>;
}

interface PortfolioValueResult {
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
}

interface InventorNetworkQuery {
  action: "inventor_network";
  inventor_name?: string;
  assignee?: string;
  patent_ids?: string[];
  limit?: number;
}

// AI Prior Art Discovery - Autonomous multi-step agent for finding prior art
interface PriorArtQuery {
  action: "ai_prior_art";
  patent_id: string;
  patent_title: string;
  patent_abstract: string;
  claims_text?: string;
  filing_date?: string;
}

interface PriorArtResult {
  powered_by: "Gemini 3";
  target_patent: string;
  key_concepts: string[];
  search_strategy: {
    keywords: string[];
    cpc_codes: string[];
    date_range: { before: string };
  };
  prior_art_candidates: Array<{
    patent_id: string;
    patent_title: string;
    relevance_score: number;
    overlap_summary: string;
    key_matching_elements: string[];
  }>;
  analysis_summary: string;
  generated_at: string;
}

// AI Patent Landscape Analysis - Competitive landscape overview for a technology domain
interface LandscapeQuery {
  action: "ai_landscape";
  query: string;
  patents: Array<{
    patent_id: string;
    patent_title: string;
    patent_abstract: string;
    assignee?: string;
    filing_date?: string;
  }>;
}

interface LandscapeResult {
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
}

interface InventorNetworkResult {
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
}

// AI Freedom to Operate (FTO) Risk Analyzer
interface FTOAnalyzeQuery {
  action: "ai_fto_analyze";
  product_description: string;
  patents: Array<{
    patent_id: string;
    patent_title: string;
    patent_abstract: string;
    claims_text?: string;
  }>;
}

interface FTOAnalysisResult {
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
}

// Firecrawl - Patent content scraping with round-robin API key rotation
interface FirecrawlScrapeQuery {
  action: "firecrawl_scrape";
  patent_id: string;
  patent_url?: string;  // Optional custom URL, defaults to Google Patents
}

interface FirecrawlResult {
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

// Firecrawl API keys for round-robin rotation
const FIRECRAWL_KEYS = [
  Deno.env.get("FIRECRAWL_API_KEY_1"),
  Deno.env.get("FIRECRAWL_API_KEY_2"),
  Deno.env.get("FIRECRAWL_API_KEY_3"),
  Deno.env.get("FIRECRAWL_API_KEY_4"),
  Deno.env.get("FIRECRAWL_API_KEY_5"),
  Deno.env.get("FIRECRAWL_API_KEY_6"),
  Deno.env.get("FIRECRAWL_API_KEY_7"),
  Deno.env.get("FIRECRAWL_API_KEY_8"),
].filter((key): key is string => Boolean(key && key.trim()));

let firecrawlKeyIndex = 0;

function getNextFirecrawlKey(): string | null {
  if (FIRECRAWL_KEYS.length === 0) return null;
  const key = FIRECRAWL_KEYS[firecrawlKeyIndex % FIRECRAWL_KEYS.length];
  firecrawlKeyIndex = (firecrawlKeyIndex + 1) % FIRECRAWL_KEYS.length;
  return key;
}

/**
 * Extract key sections from Firecrawl markdown for LLM context
 * Limits total size to prevent context overflow (~6000 chars max)
 */
function extractPatentContext(markdown: string): {
  abstract: string;
  claims: string;
  fieldOfInvention: string;
  description: string;
} {
  // Extract Abstract (### Abstract followed by content until next section)
  const abstractMatch = markdown.match(/###\s*Abstract[^\n]*\n\n([\s\S]*?)(?=\n###|\n##|Images|\[)/i);
  const abstract = abstractMatch?.[1]?.trim().slice(0, 2000) || '';

  // Extract numbered claims (patterns like "1. A method..." or "1. The system...")
  const claimsMatch = markdown.match(/(?:Claims|What is claimed)[\s\S]*?(\n\d+\.\s+[\s\S]*?)(?=\n###|\n##|Description|$)/i);
  let claims = '';
  if (claimsMatch?.[1]) {
    // Get first 5 claims only
    const claimLines = claimsMatch[1].match(/\n\d+\.\s+[^\n]+/g);
    if (claimLines) {
      claims = claimLines.slice(0, 5).join('\n').trim().slice(0, 3000);
    }
  }

  // Extract Field of Invention
  const fieldMatch = markdown.match(/FIELD OF THE INVENTION\n\n([\s\S]*?)(?=\n[A-Z]{4,}|PRIOR ART|\n##)/i);
  const fieldOfInvention = fieldMatch?.[1]?.trim().slice(0, 800) || '';

  // Extract first part of Description (technical overview)
  const descMatch = markdown.match(/###\s*Description[^\n]*\n\n([\s\S]{0,2000})/i);
  const description = descMatch?.[1]?.trim() || '';

  return { abstract, claims, fieldOfInvention, description };
}

/**
 * Internal Firecrawl call for backend enrichment (no HTTP response wrapper)
 * Uses same round-robin key rotation with retry
 */
async function callFirecrawlInternal(patentId: string): Promise<{
  success: boolean;
  markdown?: string;
  error?: string;
}> {
  const patentUrl = `https://patents.google.com/patent/${patentId}/en`;
  const maxAttempts = Math.min(FIRECRAWL_KEYS.length, 7);
  let lastError = "";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const apiKey = getNextFirecrawlKey();
    if (!apiKey) break;

    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: patentUrl,
          onlyMainContent: true,
          formats: ["markdown"],
        }),
      });

      if (response.status === 429 || response.status === 402) {
        lastError = response.status === 429 ? "Rate limit" : "Credits exhausted";
        continue;
      }

      if (!response.ok) {
        lastError = `API error: ${response.status}`;
        continue;
      }

      const result = await response.json();
      if (result.success && result.data?.markdown) {
        return { success: true, markdown: result.data.markdown };
      }
      lastError = result.error || "No markdown returned";
    } catch (e) {
      lastError = (e as Error).message;
    }
  }

  return { success: false, error: lastError };
}

type RequestBody = SearchQuery | AnalyzeQuery | BulkAnalyzeQuery | WatchlistQuery | PortfolioQuery | EnrichQuery | CitationsQuery | AssigneePatentsQuery | AIAnalyzeQuery | AICompareQuery | QueryExpandQuery | ClaimGraphQuery | PortfolioValueQuery | InventorNetworkQuery | PriorArtQuery | FTOAnalyzeQuery | FirecrawlScrapeQuery;

interface PatentsViewPatent {
  patent_id: string;
  patent_number: string;
  patent_title: string;
  patent_abstract: string;
  patent_date: string;
  patent_type: string;
  patent_kind: string;
  num_claims: number;
  patent_firstnamed_assignee_city: string;
  patent_firstnamed_assignee_country: string;
  patent_earliest_application_date?: string | null;
  patent_term_extension?: number | null;
  assignees?: Array<{
    assignee_organization: string;
    assignee_type: string;
  }>;
  inventors?: Array<{
    inventor_first_name: string;
    inventor_last_name: string;
  }>;
  applications?: Array<{
    app_date: string;
    app_type: string;
  }>;
  cpcs?: Array<{
    cpc_group_id: string;
    cpc_group_title: string;
  }>;
  cpc_current?: Array<{
    cpc_group_id: string;
    cpc_group_title?: string;
  }>;
  uspc_at_issue?: Array<{
    uspc_mainclass_id: string;
    uspc_subclass_id?: string;
  }>;
}

interface MaintenanceFeeSchedule {
  year_3_5: { due_date: string; window_start: string; window_end: string; surcharge_end: string };
  year_7_5: { due_date: string; window_start: string; window_end: string; surcharge_end: string };
  year_11_5: { due_date: string; window_start: string; window_end: string; surcharge_end: string };
}

function parsePatentNumber(input: string): { number: string; fullId: string; isApplication: boolean } | null {
  if (!input) return null;

  const cleanInput = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  const usMatch = cleanInput.match(/^US?(\d{6,11})([AB]\d)?$/);
  if (usMatch) {
    const num = usMatch[1];
    const suffix = usMatch[2] || "";
    return {
      number: num,
      fullId: `US${num}${suffix}`,
      isApplication: num.length >= 10 || suffix.length > 0,
    };
  }

  const numOnly = cleanInput.match(/^(\d{6,11})$/);
  if (numOnly) {
    return {
      number: numOnly[1],
      fullId: `US${numOnly[1]}`,
      isApplication: numOnly[1].length >= 10,
    };
  }

  return null;
}

function calculateMaintenanceFeeSchedule(grantDateStr: string): MaintenanceFeeSchedule {
  const grantDate = new Date(grantDateStr);

  const addMonthsClamped = (date: Date, months: number): Date => {
    const originalDay = date.getDate();
    const targetMonth = date.getMonth() + months;
    const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const lastDayOfMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
    const clampedDay = Math.min(originalDay, lastDayOfMonth);
    return new Date(targetYear, normalizedMonth, clampedDay);
  };

  const addYearsClamped = (date: Date, years: number): Date => {
    return addMonthsClamped(date, years * 12);
  };

  const formatDate = (date: Date): string => date.toISOString().split("T")[0];

  const year3_5_due = addMonthsClamped(addYearsClamped(grantDate, 3), 6);
  const year7_5_due = addMonthsClamped(addYearsClamped(grantDate, 7), 6);
  const year11_5_due = addMonthsClamped(addYearsClamped(grantDate, 11), 6);

  return {
    year_3_5: {
      due_date: formatDate(year3_5_due),
      window_start: formatDate(addMonthsClamped(year3_5_due, -6)),
      window_end: formatDate(year3_5_due),
      surcharge_end: formatDate(addMonthsClamped(year3_5_due, 6)),
    },
    year_7_5: {
      due_date: formatDate(year7_5_due),
      window_start: formatDate(addMonthsClamped(year7_5_due, -6)),
      window_end: formatDate(year7_5_due),
      surcharge_end: formatDate(addMonthsClamped(year7_5_due, 6)),
    },
    year_11_5: {
      due_date: formatDate(year11_5_due),
      window_start: formatDate(addMonthsClamped(year11_5_due, -6)),
      window_end: formatDate(year11_5_due),
      surcharge_end: formatDate(addMonthsClamped(year11_5_due, 6)),
    },
  };
}

function calculateDesignPatentExpirationDate(
  grantDateStr: string,
  filingDateStr: string
): { expiry: string; reason: string; is_active: boolean } {
  /**
   * Calculate expiration for design patents.
   * Design patents filed before 2015-05-13: 14 years from grant date
   * Design patents filed on/after 2015-05-13: 15 years from grant date
   */
  const grantDate = new Date(grantDateStr);
  const filingDate = new Date(filingDateStr);

  const cutoffDate = new Date("2015-05-13");
  const yearsToAdd = filingDate >= cutoffDate ? 15 : 14;

  // Calculate baseline by adding years
  const baseExpiry = new Date(grantDate);
  const targetYear = baseExpiry.getFullYear() + yearsToAdd;

  // Handle Feb 29 edge case
  if (grantDate.getMonth() === 1 && grantDate.getDate() === 29) {
    const isLeapYear = (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0;
    if (!isLeapYear) {
      baseExpiry.setFullYear(targetYear);
      baseExpiry.setMonth(1);
      baseExpiry.setDate(28);
    } else {
      baseExpiry.setFullYear(targetYear);
    }
  } else {
    baseExpiry.setFullYear(targetYear);
  }

  const reason = `${yearsToAdd} years from grant date`;
  const now = new Date();
  const isActive = now < baseExpiry;

  return {
    expiry: baseExpiry.toISOString().split("T")[0],
    reason,
    is_active: isActive,
  };
}

function calculateExpirationDate(
  filingDateStr: string,
  grantDateStr: string,
  ptaDays: number = 0,
  pteDays: number = 0,
  terminalDisclaimerDate: string | null = null
): { expiry: string; reason: string; is_active: boolean } {
  const filingDate = new Date(filingDateStr);

  // Calculate baseExpiry with proper year clamping (handles Feb 29 edge case)
  const baseExpiry = new Date(filingDate);
  const targetYear = baseExpiry.getFullYear() + 20;

  // If filing date is Feb 29 and target year is not a leap year, clamp to Feb 28
  if (filingDate.getMonth() === 1 && filingDate.getDate() === 29) {
    const isLeapYear = (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0;
    if (!isLeapYear) {
      baseExpiry.setFullYear(targetYear);
      baseExpiry.setMonth(1);
      baseExpiry.setDate(28);
    } else {
      baseExpiry.setFullYear(targetYear);
    }
  } else {
    baseExpiry.setFullYear(targetYear);
  }

  const adjustedExpiry = new Date(baseExpiry);
  adjustedExpiry.setDate(adjustedExpiry.getDate() + ptaDays + pteDays);

  let finalExpiry = adjustedExpiry;
  let reason = `20 years from filing`;

  if (ptaDays > 0) {
    reason += ` + ${ptaDays} days PTA`;
  }
  if (pteDays > 0) {
    reason += ` + ${pteDays} days PTE`;
  }

  if (terminalDisclaimerDate) {
    const tdDate = new Date(terminalDisclaimerDate);
    if (tdDate < finalExpiry) {
      finalExpiry = tdDate;
      reason = `Terminal Disclaimer (expires with linked patent)`;
    }
  }

  const now = new Date();
  const isActive = now < finalExpiry;

  return {
    expiry: finalExpiry.toISOString().split("T")[0],
    reason,
    is_active: isActive,
  };
}

async function searchPatentsView(
  query: string,
  page: number = 1,
  perPage: number = 25,
  sort: "relevance" | "date_desc" | "date_asc" = "relevance"
): Promise<{ patents: Record<string, unknown>[]; total: number }> {
  const apiKey = Deno.env.get("PATENTSVIEW_API_KEY");

  if (!apiKey) {
    console.error("PATENTSVIEW_API_KEY environment variable not set");
    throw new Error("PatentsView API key not configured. Please contact support to enable patent search.");
  }

  const apiUrl = "https://search.patentsview.org/api/v1/patent/";

  const offset = (page - 1) * perPage;

  let sortField: Array<Record<string, string>> | undefined;
  if (sort === "date_desc") {
    sortField = [{ "patent_date": "desc" }];
  } else if (sort === "date_asc") {
    sortField = [{ "patent_date": "asc" }];
  }

  // Build comprehensive search query that searches across multiple fields
  // This improves relevance for inventor names, assignees, and technical terms
  const searchQuery = {
    "_or": [
      { "_text_any": { "patent_title": query } },
      { "_text_any": { "patent_abstract": query } },
      { "_text_any": { "inventors.inventor_last_name": query } },
      { "_text_any": { "inventors.inventor_first_name": query } },
      { "_text_any": { "assignees.assignee_organization": query } },
    ]
  };

  const requestBody: Record<string, unknown> = {
    q: searchQuery,
    f: [
      "patent_id",
      "patent_title",
      "patent_abstract",
      "patent_date",
      "patent_type",
      "patent_earliest_application_date",
      "assignees",
      "inventors",
      "cpc_current"
    ],
    o: {
      "size": perPage,
      "from": offset
    }
  };

  if (sortField) {
    requestBody.s = sortField;
  }

  console.log("PatentsView request - query:", query, "page:", page, "sort:", sort, "offset:", offset);
  console.log("PatentsView request body:", JSON.stringify(requestBody, null, 2));

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("PatentsView API error:", response.status, errorText);

    if (response.status === 403) {
      throw new Error("PatentsView API authentication failed. API key may be invalid or expired.");
    }

    throw new Error(`PatentsView API error: ${response.status}`);
  }

  const data = await response.json();
  console.log("PatentsView response - count:", data.count, "total_hits:", data.total_hits);

  if (!data.patents || data.patents.length === 0) {
    return { patents: [], total: 0 };
  }

  const patents = data.patents.map((p: PatentsViewPatent) => {
    const filingDate = p.patent_earliest_application_date || null;
    const grantDate = p.patent_date;

    let expirationInfo = null;
    if (filingDate && grantDate && p.patent_type !== "design") {
      expirationInfo = calculateExpirationDate(filingDate, grantDate, 0, 0, null);
    }

    return {
      patent_id: `US${p.patent_id}`,
      patent_number: p.patent_id,
      patent_title: p.patent_title,
      patent_abstract: p.patent_abstract,
      patent_date: p.patent_date,
      filing_date: filingDate,
      patent_type: p.patent_type,
      expiration_date: expirationInfo?.expiry || null,
      is_active: expirationInfo?.is_active ?? null,
      assignees: p.assignees || [],
      inventors: p.inventors || [],
      cpc_codes: p.cpc_current || [],
      source: "patentsview",
      url: `https://patents.google.com/patent/US${p.patent_id}`,
    };
  });

  return { patents, total: data.total_hits || data.count };
}

async function getPatentFromPatentsView(patentNumber: string): Promise<Record<string, unknown> | null> {
  const apiKey = Deno.env.get("PATENTSVIEW_API_KEY");

  if (!apiKey) {
    console.error("PATENTSVIEW_API_KEY not configured");
    return null;
  }

  const apiUrl = "https://search.patentsview.org/api/v1/patent/";

  const requestBody = {
    q: { "patent_id": patentNumber },
    f: [
      "patent_id",
      "patent_title",
      "patent_abstract",
      "patent_date",
      "patent_type",
      "patent_earliest_application_date",
      "patent_term_extension",
      "assignees",
      "inventors",
      "cpc_current",
      "uspc_at_issue"
    ],
    o: { "size": 1 }
  };

  console.log("Fetching patent from PatentsView:", patentNumber);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    console.error("PatentsView error:", response.status);
    return null;
  }

  const data = await response.json();

  if (!data.patents || data.patents.length === 0) {
    console.log("Patent not found in PatentsView");
    return null;
  }

  const p = data.patents[0];
  const filingDate = p.patent_earliest_application_date || null;
  const grantDate = p.patent_date;
  const pteDays = p.patent_term_extension || 0;
  const isDesignPatent = p.patent_type && p.patent_type.toLowerCase().includes("design");

  let maintenanceFees = null;
  let expirationInfo = null;

  // Design patents do not have maintenance fees
  if (grantDate && !isDesignPatent) {
    maintenanceFees = calculateMaintenanceFeeSchedule(grantDate);
  }

  if (filingDate && grantDate) {
    if (isDesignPatent) {
      // Design patents use different expiry calculation
      expirationInfo = calculateDesignPatentExpirationDate(grantDate, filingDate);
    } else {
      // Utility/plant patents use standard 20-year rule with PTA/PTE
      expirationInfo = calculateExpirationDate(filingDate, grantDate, 0, pteDays, null);
    }
  }

  const rawData = {
    patent_id: `US${p.patent_id}`,
    patent_number: p.patent_id,
    patent_title: p.patent_title,
    patent_abstract: p.patent_abstract,
    filing_date: filingDate,
    grant_date: grantDate,
    patent_type: p.patent_type,
    assignees: p.assignees || [],
    inventors: p.inventors || [],
    cpc_codes: p.cpc_current || [],
    uspc_codes: p.uspc_at_issue || [],
    pta_days: 0,
    pte_days: pteDays,
    maintenance_fees: maintenanceFees,
    expiration: expirationInfo,
    source: "patentsview",
    url: `https://patents.google.com/patent/US${p.patent_id}`,
  };

  return normalizePatentData(rawData);
}

function normalizePatentData(patentData: Record<string, unknown>): Record<string, unknown> {
  return {
    patent_id: patentData.patent_id,
    full_id: patentData.patent_id,
    title: patentData.patent_title,
    abstract: patentData.patent_abstract,
    patent_type: patentData.patent_type,
    num_claims: patentData.num_claims,
    filing_date: patentData.filing_date,
    grant_date: patentData.grant_date,
    assignees: patentData.assignees,
    inventors: patentData.inventors,
    cpc_codes: patentData.cpc_codes,
    pta_days: patentData.pta_days || 0,
    pte_days: patentData.pte_days || 0,
    dates: {
      filed: patentData.filing_date,
      granted: patentData.grant_date,
      baseline_expiry: (patentData.expiration as Record<string, unknown>)?.expiry,
      calculated_expiry: (patentData.expiration as Record<string, unknown>)?.expiry,
      pta_days: patentData.pta_days || 0,
      pte_days: patentData.pte_days || 0,
      is_filing_estimated: false,
    },
    maintenance_fees: patentData.maintenance_fees,
    expiration: patentData.expiration,
    warnings: {
      fee_status: (patentData.patent_type as string)?.toLowerCase().includes("design")
        ? "Design patents do not require maintenance fees."
        : "Maintenance fees must be paid at 3.5, 7.5, and 11.5 years after grant to keep patent in force.",
      reason: (patentData.expiration as Record<string, unknown>)?.reason || "20 years from filing",
    },
    is_active: (patentData.expiration as Record<string, unknown>)?.is_active,
    source: "patentsview",
    url: patentData.url,
  };
}

async function getCachedAnalysis(patentId: string): Promise<{ data: Record<string, unknown>; cachedAt: string } | null> {
  const { data, error } = await supabaseService
    .from("patent_analysis_cache")
    .select("*")
    .eq("patent_id", patentId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Cache lookup error:", error);
    return null;
  }

  if (!data?.raw_data) return null;

  await supabaseService
    .from("patent_analysis_cache")
    .update({
      access_count: (data.access_count || 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq("patent_id", patentId);

  return { data: data.raw_data, cachedAt: data.fetched_at };
}

async function cacheAnalysis(patentId: string, data: Record<string, unknown>): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { error } = await supabaseService
    .from("patent_analysis_cache")
    .upsert({
      patent_id: patentId,
      raw_data: data,
      filing_date: data.filing_date,
      grant_date: data.grant_date,
      pta_days: data.pta_days || 0,
      pte_days: data.pte_days || 0,
      expiration_date: data.expiration?.expiry,
      claims_count: data.num_claims,
      cpc_codes: data.cpc_codes,
      source: data.source,
      fetched_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    }, { onConflict: "patent_id" });

  if (error) {
    console.error("Cache write error:", error);
  }
}

async function searchWithExa(query: string, numResults: number = 10): Promise<Record<string, unknown>[]> {
  const exaApiKey = Deno.env.get("EXA_API_KEY");
  if (!exaApiKey) return [];

  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": exaApiKey,
      },
      body: JSON.stringify({
        query: `${query} site:patents.google.com patent`,
        type: "auto",
        numResults,
        contents: {
          text: { maxCharacters: 1000 },
          highlights: { numSentences: 2 },
        },
        includeDomains: ["patents.google.com"],
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();

    return (data.results || []).map((r: Record<string, unknown>) => {
      const urlMatch = (r.url as string)?.match(/patent\/US(\d+)/);
      const patentNum = urlMatch ? urlMatch[1] : null;

      return {
        patent_id: patentNum ? `US${patentNum}` : null,
        patent_title: (r.title as string)?.replace(/\s*-\s*Google Patents.*$/i, "").trim(),
        patent_abstract: r.text || r.highlights?.[0],
        patent_date: r.publishedDate,
        url: r.url,
        source: "exa",
      };
    }).filter((p: Record<string, unknown>) => p.patent_id);
  } catch (e) {
    console.error("Exa search error:", e);
    return [];
  }
}

// ============================================================================
// Exa AI Enrichment - Company news, market context, product mentions
// ============================================================================

interface EnrichmentArticle {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  source?: string;
}

interface EnrichmentResult {
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

/**
 * Extract key terms from patent title for search queries
 * Simple heuristic: remove stopwords, keep top meaningful terms
 */
function extractKeyTerms(title: string): string[] {
  const stopwords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'for', 'of', 'to', 'in', 'on', 'at',
    'by', 'with', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those',
    'method', 'system', 'apparatus', 'device', 'thereof', 'therefor', 'therein',
    'comprising', 'including', 'having', 'using', 'making', 'forming',
  ]);

  const terms = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopwords.has(word));

  // Return unique terms, max 6
  return [...new Set(terms)].slice(0, 6);
}

/**
 * Clean snippet text from Exa results
 * Removes navigation elements, markdown artifacts, and other noise
 */
function cleanSnippet(text: string): string {
  if (!text) return '';

  const cleaned = text
    // Remove markdown headers
    .replace(/#{1,6}\s*/g, '')
    // Remove markdown bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    // Remove navigation-like patterns: [Home] [Contact] [Menu] etc
    .replace(/\[(?:Home|Menu|Contact|About|Products|Services|Search|Login|Sign\s?[Ii]n|Register|Cart|FAQ|Help|Support|Terms|Privacy|Cookies|Back|Next|Previous|More|View|Read|Click|Order|Buy|Subscribe|Download|Share|Print|Email|Save|Close|Exit|Submit|Send|Cancel|Reset|Clear|Delete|Edit|Update|Add|Remove|Show|Hide|Expand|Collapse|Open|Info|Details|Learn|Explore|Discover|Try|Get|Start|Begin|Continue|Skip|[A-Z][a-z]*)\s*[^\]]*\]/gi, '')
    // Remove menu-like patterns with asterisks
    .replace(/\*\s*\[[^\]]+\]\s*/g, '')
    // Remove breadcrumb-like patterns
    .replace(/>\s*\[[^\]]+\]/g, '')
    // Remove price patterns that look like navigation
    .replace(/Price\s*From:\s*[€$£][\d,.\s]+(?:EUR|USD|GBP)?[€$£]?[\d,.\s]*(?:EUR|USD|GBP)?/gi, '')
    // Remove patterns like [**] or [*]
    .replace(/\[\*+\]/g, '')
    // Remove phone numbers in brackets
    .replace(/\[\+?\d[\d\s\-()]+\]/g, '')
    // Remove empty brackets
    .replace(/\[\s*\]/g, '')
    // Remove standalone brackets with single items
    .replace(/\[[^\]]{1,3}\]/g, '')
    // Remove patterns like "- [Something] -"
    .replace(/-\s*\[[^\]]+\]\s*-/g, '')
    // Remove multiple consecutive special characters
    .replace(/[#*\-_|]{3,}/g, '')
    // Remove "View Pricing", "Get in touch", etc.
    .replace(/\b(View\s+Pricing|Get\s+in\s+touch|Learn\s+more|Read\s+more|Click\s+here|Contact\s+us|Find\s+out\s+more|See\s+details?|Book\s+a\s+demo|Try\s+for\s+free|Free\s+trial)\b/gi, '')
    // Clean up excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove leading/trailing punctuation junk
    .replace(/^[\s\-*|#:,;.]+|[\s\-*|#:,;]+$/g, '')
    .trim();

  // If cleaned text is too short or mostly symbols, return empty
  const alphaRatio = (cleaned.match(/[a-zA-Z]/g) || []).length / (cleaned.length || 1);
  if (cleaned.length < 30 || alphaRatio < 0.5) {
    return '';
  }

  return cleaned;
}

/**
 * Clean and validate article title
 */
function cleanTitle(title: string): string {
  if (!title) return '';

  return title
    // Remove common suffixes like "| Company Name", "- Site Name"
    .replace(/\s*[|\-–—]\s*[A-Z][a-zA-Z\s&.]+$/, '')
    // Remove markdown
    .replace(/[#*_]/g, '')
    .trim();
}

/**
 * Query Exa AI for enrichment data
 */
async function queryExaForEnrichment(
  queryText: string,
  numResults: number = 5,
  startDate?: string
): Promise<EnrichmentArticle[]> {
  const exaApiKey = Deno.env.get("EXA_API_KEY");
  if (!exaApiKey) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    const requestBody: Record<string, unknown> = {
      query: queryText,
      type: "auto",
      numResults: numResults + 3, // Request extra to filter out bad results
      contents: {
        text: { maxCharacters: 500 }, // Get more text for better cleaning
        highlights: { numSentences: 3 },
      },
    };

    // Add date filter for recent results (last 2 years)
    if (startDate) {
      requestBody.startPublishedDate = startDate;
    }

    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": exaApiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error("Exa enrichment error:", response.status);
      return [];
    }

    const data = await response.json();

    // Process and clean results
    const articles = (data.results || [])
      .map((r: Record<string, unknown>) => {
        const rawText = (r.text as string) || '';
        const highlights = (r.highlights as string[]) || [];

        // Try highlights first (usually cleaner), then fall back to text
        let snippet = '';
        for (const h of highlights) {
          const cleaned = cleanSnippet(h);
          if (cleaned.length > 50) {
            snippet = cleaned;
            break;
          }
        }
        if (!snippet) {
          snippet = cleanSnippet(rawText);
        }

        // Truncate to reasonable length
        if (snippet.length > 250) {
          snippet = snippet.substring(0, 247) + '...';
        }

        const title = cleanTitle(r.title as string || '');

        return {
          title,
          url: r.url as string || '',
          snippet,
          date: r.publishedDate as string | undefined,
          source: new URL(r.url as string || 'https://unknown.com').hostname.replace(/^www\./, ''),
        };
      })
      // Filter out articles with empty/bad content
      .filter((a: EnrichmentArticle) => a.title.length > 10 && a.snippet.length > 30)
      // Take only the requested number
      .slice(0, numResults);

    return articles;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      console.log("Exa query timed out");
    } else {
      console.error("Exa enrichment query error:", e);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get cached enrichment from database
 */
async function getCachedEnrichment(patentId: string): Promise<{ data: EnrichmentResult; cachedAt: string } | null> {
  const { data, error } = await supabaseService
    .from("patent_enrichments")
    .select("*")
    .eq("patent_id", patentId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;

  return {
    data: {
      patent_id: data.patent_id,
      available: true,
      from_cache: true,
      cached_at: data.cached_at,
      assignee: data.assignee,
      company_news: data.company_news || [],
      market_context: data.market_context || [],
      product_mentions: data.product_mentions || [],
    },
    cachedAt: data.cached_at,
  };
}

/**
 * Cache enrichment data in database
 */
async function cacheEnrichment(
  patentId: string,
  enrichment: EnrichmentResult
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7-day TTL

  const { error } = await supabaseService
    .from("patent_enrichments")
    .upsert({
      patent_id: patentId,
      assignee: enrichment.assignee,
      company_news: enrichment.company_news,
      market_context: enrichment.market_context,
      product_mentions: enrichment.product_mentions,
      cached_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    }, { onConflict: "patent_id" });

  if (error) {
    console.error("Enrichment cache write error:", error);
  }
}

/**
 * Handle enrichment request - fetches company news, market context, product mentions
 */
async function handleEnrich(body: EnrichQuery): Promise<Response> {
  const { patent_id, patent_title, assignee, force_refresh } = body;

  if (!patent_id) {
    return new Response(
      JSON.stringify({ error: "patent_id required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const exaApiKey = Deno.env.get("EXA_API_KEY");

  // If Exa is not configured, return graceful degradation
  if (!exaApiKey) {
    return new Response(
      JSON.stringify({
        patent_id,
        available: false,
        reason: "Enrichment service not configured",
        company_news: [],
        market_context: [],
        product_mentions: [],
      } as EnrichmentResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check cache first (unless force refresh)
  if (!force_refresh) {
    const cached = await getCachedEnrichment(patent_id);
    if (cached) {
      console.log(`Enrichment cache hit for ${patent_id}`);
      return new Response(
        JSON.stringify(cached.data),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Need assignee for meaningful enrichment
  if (!assignee) {
    return new Response(
      JSON.stringify({
        patent_id,
        available: false,
        reason: "Assignee information required for enrichment",
        company_news: [],
        market_context: [],
        product_mentions: [],
      } as EnrichmentResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`Fetching enrichment for ${patent_id}, assignee: ${assignee}`);

  // Calculate date 2 years ago for recent results
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const startDate = twoYearsAgo.toISOString().split('T')[0];

  // Extract key terms from title
  const keyTerms = patent_title ? extractKeyTerms(patent_title) : [];
  const techContext = keyTerms.slice(0, 4).join(' ');

  // Run 3 parallel Exa queries with specific focus areas
  const [companyNews, marketContext, productMentions] = await Promise.all([
    // Company news: funding, partnerships, acquisitions, lawsuits
    queryExaForEnrichment(
      `"${assignee}" (funding OR partnership OR acquisition OR lawsuit OR patent OR regulation OR FDA OR IPO)`,
      5,
      startDate
    ),

    // Market context: industry reports, competitor analysis
    queryExaForEnrichment(
      `${techContext} market analysis industry report adoption competitors`,
      5,
      startDate
    ),

    // Product mentions: evidence of commercialization
    queryExaForEnrichment(
      `"${assignee}" ${keyTerms.slice(0, 2).join(' ')} (product OR launch OR "powered by" OR integrates OR announces)`,
      5,
      startDate
    ),
  ]);

  const enrichment: EnrichmentResult = {
    patent_id,
    available: true,
    assignee,
    company_news: companyNews,
    market_context: marketContext,
    product_mentions: productMentions,
  };

  // Cache the results
  await cacheEnrichment(patent_id, enrichment);

  return new Response(
    JSON.stringify(enrichment),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Handle citations request - forward/backward citations from PatentsView
 */
async function handleCitations(body: CitationsQuery): Promise<Response> {
  const { patent_id } = body;

  if (!patent_id) {
    return new Response(
      JSON.stringify({ error: "patent_id required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const apiKey = Deno.env.get("PATENTSVIEW_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "PatentsView API not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Parse patent number (remove US prefix if present)
  const patentNum = patent_id.replace(/^US/i, '');

  try {
    const citationUrl = "https://search.patentsview.org/api/v1/patent/us_patent_citation/";
    const patentUrl = "https://search.patentsview.org/api/v1/patent/";

    // Get patents that cite this one (forward citations)
    // Query where citation_patent_id = our patent (meaning other patents cite us)
    const citedByResponse = await fetch(citationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        q: { "citation_patent_id": patentNum },
        f: ["patent_id", "citation_patent_id", "citation_date", "citation_category"],
        o: { size: 20 },
      }),
    });

    if (!citedByResponse.ok) {
      throw new Error(`PatentsView API error: ${citedByResponse.status} ${citedByResponse.statusText}`);
    }

    // Get patents that this patent cites (backward citations)
    // Query where patent_id = our patent (meaning we cite other patents)
    const citesResponse = await fetch(citationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        q: { "patent_id": patentNum },
        f: ["patent_id", "citation_patent_id", "citation_date", "citation_category"],
        o: { size: 20 },
      }),
    });

    if (!citesResponse.ok) {
      throw new Error(`PatentsView API error: ${citesResponse.status} ${citesResponse.statusText}`);
    }

    const citedByData = await citedByResponse.json();
    const citesData = await citesResponse.json();

    // Extract patent IDs that we need to fetch details for
    const citedByPatentIds = (citedByData.us_patent_citations || []).map((c: Record<string, unknown>) =>
      String(c.patent_id).toUpperCase()
    );
    const citesPatentIds = (citesData.us_patent_citations || []).map((c: Record<string, unknown>) =>
      String(c.citation_patent_id).toUpperCase()
    );

    // Fetch patent details (title, date) for all cited patents
    const allPatentIds = Array.from(new Set([...citedByPatentIds, ...citesPatentIds]));
    const patentDetailsMap: Record<string, { patent_title: string; patent_date: string; assignee?: string }> = {};

    if (allPatentIds.length > 0) {
      // Build query to fetch details for all patents at once
      const patentDetailsResponse = await fetch(patentUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({
          q: { "patent_id": { "_in": allPatentIds } },
          f: ["patent_id", "patent_title", "patent_date", "assignees"],
          o: { size: allPatentIds.length },
        }),
      });

      if (patentDetailsResponse.ok) {
        const patentDetails = await patentDetailsResponse.json();
        for (const p of patentDetails.patents || []) {
          patentDetailsMap[String(p.patent_id).toUpperCase()] = {
            patent_title: p.patent_title || "Unknown",
            patent_date: p.patent_date || "",
            assignee: (p.assignees as Record<string, unknown>[])?.[0]?.assignee_organization as string | undefined,
          };
        }
      }
    }

    // Map citations with full patent details
    const citedBy = (citedByData.us_patent_citations || []).map((c: Record<string, unknown>) => {
      const patentId = String(c.patent_id).toUpperCase();
      const details = patentDetailsMap[patentId] || { patent_title: "Unknown", patent_date: "" };
      return {
        patent_id: `US${c.patent_id}`,
        patent_title: details.patent_title,
        patent_date: details.patent_date,
        assignee: details.assignee,
      };
    });

    const cites = (citesData.us_patent_citations || []).map((c: Record<string, unknown>) => {
      const patentId = String(c.citation_patent_id).toUpperCase();
      const details = patentDetailsMap[patentId] || { patent_title: "Unknown", patent_date: "" };
      return {
        patent_id: `US${c.citation_patent_id}`,
        patent_title: details.patent_title,
        patent_date: details.patent_date,
        assignee: details.assignee,
      };
    });

    return new Response(
      JSON.stringify({
        patent_id,
        cited_by: citedBy,
        cited_by_count: citedBy.length,
        cites,
        cites_count: cites.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Citations fetch error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch citations" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handle assignee patents request - find other patents from same assignee
 */
async function handleAssigneePatents(body: AssigneePatentsQuery): Promise<Response> {
  const { assignee, patent_id, limit = 10 } = body;

  if (!assignee) {
    return new Response(
      JSON.stringify({ error: "assignee required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const apiKey = Deno.env.get("PATENTSVIEW_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "PatentsView API not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const response = await fetch("https://search.patentsview.org/api/v1/patent/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        q: { "_text_any": { "assignees.assignee_organization": assignee } },
        f: ["patent_id", "patent_title", "patent_date", "cpc_current"],
        o: { size: limit + 1 }, // +1 to account for exclusion
        s: [{ "patent_date": "desc" }],
      }),
    });

    if (!response.ok) {
      throw new Error(`PatentsView API error: ${response.status}`);
    }

    const data = await response.json();

    // Filter out the current patent and limit results
    const excludeId = patent_id?.replace(/^US/i, '');
    const patents = (data.patents || [])
      .filter((p: Record<string, unknown>) => p.patent_id !== excludeId)
      .slice(0, limit)
      .map((p: Record<string, unknown>) => ({
        patent_id: `US${p.patent_id}`,
        patent_title: p.patent_title,
        patent_date: p.patent_date,
        cpc_codes: (p.cpc_current as Record<string, unknown>[] || []).slice(0, 3).map(c => c.cpc_group_id),
      }));

    return new Response(
      JSON.stringify({
        assignee,
        patents,
        count: patents.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Assignee patents fetch error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch assignee patents" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleSearch(body: SearchQuery): Promise<Response> {
  const { query, page = 1, per_page = 25, sort = "relevance" } = body;

  if (!query || query.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "Query parameter is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (page < 1) {
    return new Response(
      JSON.stringify({ error: "Page must be >= 1" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (per_page < 1 || per_page > 100) {
    return new Response(
      JSON.stringify({ error: "per_page must be between 1 and 100" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const validSorts = ["relevance", "date_desc", "date_asc"];
  if (!validSorts.includes(sort)) {
    return new Response(
      JSON.stringify({ error: `Invalid sort parameter. Must be one of: ${validSorts.join(", ")}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const pvResults = await searchPatentsView(query, page, per_page, sort);

    if (pvResults.patents.length > 0) {
      return new Response(
        JSON.stringify({
          query,
          results: pvResults.patents,
          total_count: pvResults.total,
          page,
          per_page,
          total_pages: Math.ceil(pvResults.total / per_page),
          has_next: page * per_page < pvResults.total,
          has_prev: page > 1,
          source: "patentsview",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("PatentsView returned no results, trying Exa");
    const exaResults = await searchWithExa(query, per_page);

    return new Response(
      JSON.stringify({
        query,
        results: exaResults,
        total_count: exaResults.length,
        page: 1,
        per_page,
        total_pages: 1,
        has_next: false,
        has_prev: false,
        source: "exa",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, results: [], total_count: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleAnalyze(body: AnalyzeQuery): Promise<Response> {
  const { patent_id, force_refresh = false } = body;

  const parsed = parsePatentNumber(patent_id);
  if (!parsed) {
    return new Response(
      JSON.stringify({ error: "Invalid patent ID format" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!force_refresh) {
    const cached = await getCachedAnalysis(parsed.fullId);
    if (cached) {
      console.log("Returning cached analysis for:", parsed.fullId);
      return new Response(
        JSON.stringify({ ...cached.data, from_cache: true, cached_at: cached.cachedAt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const patentData = await getPatentFromPatentsView(parsed.number);

  if (!patentData) {
    return new Response(
      JSON.stringify({
        error: "Patent not found",
        patent_id: parsed.fullId,
        suggestion: "Verify the patent number is correct. Applications may not be in the database.",
      }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  await cacheAnalysis(parsed.fullId, patentData);

  return new Response(
    JSON.stringify(patentData),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleBulkAnalyze(body: BulkAnalyzeQuery): Promise<Response> {
  const { patent_ids } = body;

  if (!patent_ids || patent_ids.length === 0) {
    return new Response(
      JSON.stringify({ error: "No patent IDs provided" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (patent_ids.length > 50) {
    return new Response(
      JSON.stringify({ error: "Maximum 50 patents per bulk request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: Record<string, unknown>[] = [];
  const errors: Record<string, string>[] = [];

  for (const id of patent_ids) {
    try {
      const parsed = parsePatentNumber(id);
      if (!parsed) {
        errors.push({ patent_id: id, error: "Invalid format" });
        continue;
      }

      const cached = await getCachedAnalysis(parsed.fullId);
      if (cached) {
        results.push({ ...cached.data, from_cache: true, cached_at: cached.cachedAt });
        continue;
      }

      const data = await getPatentFromPatentsView(parsed.number);
      if (data) {
        await cacheAnalysis(parsed.fullId, data);
        results.push(data);
      } else {
        errors.push({ patent_id: id, error: "Not found" });
      }
    } catch (e) {
      errors.push({ patent_id: id, error: (e as Error).message });
    }
  }

  const activeCount = results.filter(r => r.expiration?.is_active).length;
  const expiredCount = results.filter(r => r.expiration?.is_active === false).length;

  const expiringWithin90Days = results.filter(r => {
    if (!r.expiration?.expiry) return false;
    const expiry = new Date(r.expiration.expiry as string);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
  });

  return new Response(
    JSON.stringify({
      results,
      errors,
      summary: {
        total_requested: patent_ids.length,
        successful: results.length,
        failed: errors.length,
        active_patents: activeCount,
        expired_patents: expiredCount,
        expiring_soon: expiringWithin90Days.length,
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleWatchlist(body: WatchlistQuery, req: Request): Promise<Response> {
  const { action, patent_id, patent_data, days_threshold = 90 } = body;

  let userClient: SupabaseClient;
  try {
    const auth = await requireAuth(req);
    userClient = auth.supabase;
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (action === "get_watchlist") {
    const { data, error } = await userClient
      .from("watched_patents")
      .select("*")
      .order("expiration_date", { ascending: true });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ watchlist: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (action === "get_expiring_soon") {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days_threshold);

    const { data, error } = await userClient
      .from("watched_patents")
      .select("*")
      .lte("expiration_date", cutoffDate.toISOString().split("T")[0])
      .gte("expiration_date", new Date().toISOString().split("T")[0])
      .order("expiration_date", { ascending: true });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const upcomingFees: Record<string, unknown>[] = [];
    const now = new Date();
    const feeThreshold = new Date();
    feeThreshold.setDate(feeThreshold.getDate() + days_threshold);

    const { data: allWatched } = await userClient.from("watched_patents").select("*");

    for (const patent of allWatched || []) {
      for (const feeField of ["fee_3_5_year_date", "fee_7_5_year_date", "fee_11_5_year_date"]) {
        const feeDate = patent[feeField];
        if (feeDate) {
          const feeDateObj = new Date(feeDate);
          if (feeDateObj >= now && feeDateObj <= feeThreshold) {
            upcomingFees.push({
              patent_id: patent.patent_id,
              patent_title: patent.patent_title,
              fee_type: feeField.replace("fee_", "").replace("_year_date", " year"),
              due_date: feeDate,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        expiring_patents: data,
        upcoming_fees: upcomingFees.sort((a, b) =>
          new Date(a.due_date as string).getTime() - new Date(b.due_date as string).getTime()
        ),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (action === "add_to_watchlist") {
    if (!patent_id) {
      return new Response(
        JSON.stringify({ error: "patent_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let fees = null;
    if (patent_data?.grant_date) {
      fees = calculateMaintenanceFeeSchedule(patent_data.grant_date as string);
    }

    const { data, error } = await userClient
      .from("watched_patents")
      .upsert({
        patent_id,
        patent_title: patent_data?.title || patent_data?.patent_title,
        filing_date: patent_data?.filing_date,
        grant_date: patent_data?.grant_date,
        expiration_date: patent_data?.expiration?.expiry || patent_data?.dates?.calculated_expiry,
        pta_days: patent_data?.dates?.pta_days || 0,
        pte_days: patent_data?.dates?.pte_days || 0,
        assignee: patent_data?.assignees?.[0]?.assignee_organization,
        fee_3_5_year_date: fees?.year_3_5?.due_date,
        fee_7_5_year_date: fees?.year_7_5?.due_date,
        fee_11_5_year_date: fees?.year_11_5?.due_date,
      }, { onConflict: "user_id,patent_id" })
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, watched_patent: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (action === "remove_from_watchlist") {
    if (!patent_id) {
      return new Response(
        JSON.stringify({ error: "patent_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error } = await userClient
      .from("watched_patents")
      .delete()
      .eq("patent_id", patent_id);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ error: "Unknown watchlist action" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handlePortfolio(body: PortfolioQuery, req: Request): Promise<Response> {
  const { action, portfolio_id, name, description, patent_id, patent_title } = body;

  let userClient: SupabaseClient;
  try {
    const auth = await requireAuth(req);
    userClient = auth.supabase;
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (action === "list_portfolios") {
    const { data, error } = await userClient
      .from("portfolio_groups")
      .select(`
        *,
        portfolio_patents(count)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ portfolios: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (action === "create_portfolio") {
    if (!name) {
      return new Response(
        JSON.stringify({ error: "Portfolio name required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await userClient
      .from("portfolio_groups")
      .insert({ name, description })
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, portfolio: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (action === "add_to_portfolio") {
    if (!portfolio_id || !patent_id) {
      return new Response(
        JSON.stringify({ error: "portfolio_id and patent_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error } = await userClient
      .from("portfolio_patents")
      .insert({ portfolio_id, patent_id, patent_title });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (action === "get_portfolio") {
    if (!portfolio_id) {
      return new Response(
        JSON.stringify({ error: "portfolio_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: portfolio, error: portError } = await userClient
      .from("portfolio_groups")
      .select("*")
      .eq("id", portfolio_id)
      .single();

    if (portError) {
      return new Response(
        JSON.stringify({ error: portError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: patents, error: patError } = await userClient
      .from("portfolio_patents")
      .select("*")
      .eq("portfolio_id", portfolio_id);

    if (patError) {
      return new Response(
        JSON.stringify({ error: patError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ portfolio, patents }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (action === "analyze_portfolio") {
    if (!portfolio_id) {
      return new Response(
        JSON.stringify({ error: "portfolio_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: patents } = await userClient
      .from("portfolio_patents")
      .select("patent_id")
      .eq("portfolio_id", portfolio_id);

    if (!patents || patents.length === 0) {
      return new Response(
        JSON.stringify({ error: "Portfolio has no patents" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bulkResponse = await handleBulkAnalyze({
      action: "bulk_analyze",
      patent_ids: patents.map(p => p.patent_id),
    });

    return bulkResponse;
  }

  return new Response(
    JSON.stringify({ error: "Unknown portfolio action" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ============================================================================
// Gemini 3 AI Analysis - Patent Intelligence Engine
// ============================================================================

interface AIAnalysisResult {
  patent_id: string;
  analysis_type: "full";
  powered_by: "Gemini 3";
  claims_summary: string;
  technical_scope: string;
  key_innovations: string[];
  potential_applications: string[];
  fto_considerations: string;
  competitive_landscape: string;
  generated_at: string;
}

/**
 * Call Gemini 3 API for patent analysis
 * Uses structured output for consistent, parseable responses
 */
async function callGemini(prompt: string): Promise<string> {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiApiKey) {
    console.error("[callGemini] GEMINI_API_KEY not found in environment");
    throw new Error("GEMINI_API_KEY not configured");
  }

  console.log("[callGemini] Making API request to Gemini...");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[callGemini] API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    console.log("[callGemini] Response received, checking structure...");

    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      console.error("[callGemini] Invalid response structure:", JSON.stringify(data).substring(0, 500));
      throw new Error("Invalid Gemini response structure - no text content");
    }

    console.log("[callGemini] Success, text length:", data.candidates[0].content.parts[0].text.length);
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("[callGemini] Exception:", error);
    throw error;
  }
}

/**
 * Parse JSON from Gemini response, handling markdown code blocks and malformed JSON
 * More robust parsing for Gemini 3 Flash which may output differently than 2.0
 */
function parseGeminiJSON<T>(text: string): T {
  let cleanText = text.trim();

  // Remove markdown code blocks if present
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.slice(7);
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.slice(3);
  }
  if (cleanText.endsWith("```")) {
    cleanText = cleanText.slice(0, -3);
  }
  cleanText = cleanText.trim();

  // Try direct parse first
  try {
    return JSON.parse(cleanText);
  } catch (firstError) {
    console.log("[parseGeminiJSON] First parse failed, attempting recovery...");

    // Try to extract JSON object/array from mixed content
    const jsonMatch = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        // Continue to next recovery attempt
      }
    }

    // Try to fix common issues: unterminated strings, trailing commas
    let fixedText = cleanText
      .replace(/,\s*([}\]])/g, '$1')  // Remove trailing commas
      .replace(/(["\w])\s*\n\s*"/g, '$1", "'); // Fix broken multi-line strings

    // If string is truncated, try to close it
    const openBraces = (fixedText.match(/\{/g) || []).length;
    const closeBraces = (fixedText.match(/\}/g) || []).length;
    const openBrackets = (fixedText.match(/\[/g) || []).length;
    const closeBrackets = (fixedText.match(/\]/g) || []).length;

    // Try to close unclosed structures
    if (openBraces > closeBraces || openBrackets > closeBrackets) {
      // Find last complete property and truncate there
      const lastPropertyEnd = fixedText.lastIndexOf('",');
      if (lastPropertyEnd > 0) {
        fixedText = fixedText.slice(0, lastPropertyEnd + 1);
        // Close remaining structures
        for (let i = 0; i < openBrackets - closeBrackets; i++) fixedText += ']';
        for (let i = 0; i < openBraces - closeBraces; i++) fixedText += '}';
      }
    }

    try {
      return JSON.parse(fixedText);
    } catch (e) {
      console.error("[parseGeminiJSON] All recovery attempts failed. Original text:", cleanText.substring(0, 500));
      throw firstError; // Throw original error for better debugging
    }
  }
}

/**
 * Handle AI analysis request using Gemini 3
 * 
 * MULTI-STEP ORCHESTRATION PATTERN (Action Era Architecture)
 * ============================================================
 * This implements a 3-step AI pipeline for autonomous patent analysis:
 * 
 * Step 1: EXTRACT - Pull key claims, domain, prior art signals
 * Step 2: ANALYZE - Deep FTO assessment, risk factors, competitive intel
 * Step 3: SYNTHESIZE - Strategic recommendations with confidence scores
 * 
 * Each step builds on the previous, demonstrating chained reasoning
 * rather than a single prompt wrapper.
 */
async function handleAIAnalyze(body: AIAnalyzeQuery): Promise<Response> {
  let { patent_id, patent_title, patent_abstract, claims_text, assignee, filing_date, expiration_date } = body;

  if (!patent_id || !patent_title || !patent_abstract) {
    return new Response(
      JSON.stringify({ error: "patent_id, patent_title, and patent_abstract are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiApiKey) {
    return new Response(
      JSON.stringify({
        patent_id,
        available: false,
        reason: "Gemini AI analysis not configured. Set GEMINI_API_KEY in Supabase secrets.",
        powered_by: "Gemini 3",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[AI Pipeline] Starting multi-step analysis for patent: ${patent_id}`);
  const startTime = Date.now();

  try {
    // ========================================================================
    // STEP 0: ENRICHMENT - Fetch richer content via Firecrawl if needed
    // ========================================================================
    let firecrawlEnriched = false;
    if (!claims_text || patent_abstract.length < 300) {
      console.log(`[AI Pipeline] Step 0: Firecrawl enrichment for ${patent_id} (abstract: ${patent_abstract.length} chars, claims: ${claims_text ? 'present' : 'missing'})`);
      try {
        const firecrawlResult = await callFirecrawlInternal(patent_id);
        if (firecrawlResult.success && firecrawlResult.markdown) {
          const extracted = extractPatentContext(firecrawlResult.markdown);
          console.log(`[AI Pipeline] Firecrawl extracted: abstract=${extracted.abstract.length} chars, claims=${extracted.claims.length} chars, field=${extracted.fieldOfInvention.length} chars`);

          // Enrich with Firecrawl data if better
          if (extracted.abstract.length > patent_abstract.length) {
            patent_abstract = extracted.abstract;
            console.log(`[AI Pipeline] Using Firecrawl abstract (${extracted.abstract.length} chars)`);
          }
          if (!claims_text && extracted.claims.length > 0) {
            claims_text = extracted.claims;
            console.log(`[AI Pipeline] Using Firecrawl claims (${extracted.claims.length} chars)`);
          }
          // Add field of invention to abstract for better context
          if (extracted.fieldOfInvention && !patent_abstract.includes(extracted.fieldOfInvention.slice(0, 50))) {
            patent_abstract = `${patent_abstract}\n\nFIELD OF INVENTION: ${extracted.fieldOfInvention}`;
          }
          firecrawlEnriched = true;
        } else {
          console.log(`[AI Pipeline] Firecrawl failed: ${firecrawlResult.error}, continuing with basic data`);
        }
      } catch (e) {
        console.warn(`[AI Pipeline] Firecrawl enrichment error: ${(e as Error).message}, continuing with basic data`);
      }
    }

    // ========================================================================
    // STEP 1: EXTRACTION - Focus on pulling structured data from patent
    // ========================================================================
    console.log(`[AI Pipeline] Step 1/3: Extraction for ${patent_id}`);
    const extractionPrompt = `You are a patent claim specialist. Extract key structured information from this patent.

PATENT DATA:
- Title: ${patent_title}
- Abstract: ${patent_abstract.substring(0, 1500)}
${claims_text ? `- Claims: ${claims_text.substring(0, 1000)}` : ""}

Extract and return JSON ONLY:
{
  "primary_domain": "2-3 word technical domain (e.g. 'semiconductor manufacturing', 'machine learning', 'wireless communications')",
  "core_invention": "One sentence: what is the novel invention claimed?",
  "key_claim_elements": ["element1", "element2", "element3"],
  "prior_art_keywords": ["keyword1", "keyword2", "keyword3"]
}`;

    const extractionResponse = await callGemini(extractionPrompt);
    const extraction = parseGeminiJSON<{
      primary_domain: string;
      core_invention: string;
      key_claim_elements: string[];
      prior_art_keywords: string[];
    }>(extractionResponse);

    console.log(`[AI Pipeline] Step 1 complete: domain="${extraction.primary_domain}"`);

    // ========================================================================
    // STEP 2: ANALYSIS - Deep reasoning over extracted data
    // ========================================================================
    console.log(`[AI Pipeline] Step 2/3: Analysis for ${patent_id}`);
    const analysisPrompt = `You are a patent strategy analyst. Using the extracted patent data, provide deep analysis.

EXTRACTED DATA:
- Domain: ${extraction.primary_domain}
- Core Invention: ${extraction.core_invention}
- Key Elements: ${extraction.key_claim_elements.join(", ")}
- Prior Art Keywords: ${extraction.prior_art_keywords.join(", ")}

CONTEXT:
- Patent ID: ${patent_id}
${assignee ? `- Assignee: ${assignee}` : ""}
${filing_date ? `- Filed: ${filing_date}` : ""}
${expiration_date ? `- Expires: ${expiration_date}` : ""}

Analyze and return JSON ONLY:
{
  "technical_scope": "Describe the technical boundaries of protection. What specifically is and isn't covered?",
  "fto_risk_level": "LOW|MEDIUM|HIGH",
  "fto_considerations": "What activities would require a license? What design-arounds exist?",
  "competitive_threats": ["threat1", "threat2"],
  "market_applications": ["application1", "application2", "application3"]
}`;

    const analysisResponse = await callGemini(analysisPrompt);
    const analysis = parseGeminiJSON<{
      technical_scope: string;
      fto_risk_level: string;
      fto_considerations: string;
      competitive_threats: string[];
      market_applications: string[];
    }>(analysisResponse);

    console.log(`[AI Pipeline] Step 2 complete: FTO risk="${analysis.fto_risk_level}"`);

    // ========================================================================
    // STEP 3: SYNTHESIS - Final recommendations with confidence
    // ========================================================================
    console.log(`[AI Pipeline] Step 3/3: Synthesis for ${patent_id}`);
    const synthesisPrompt = `You are a senior patent counsel. Synthesize the extraction and analysis into actionable recommendations.

EXTRACTION:
${JSON.stringify(extraction, null, 2)}

ANALYSIS:
${JSON.stringify(analysis, null, 2)}

ASSIGNEE: ${assignee || "Unknown"}

Synthesize and return JSON ONLY:
{
  "claims_summary": "2-3 sentence plain-language summary of what this patent protects. Make it understandable to a non-expert.",
  "key_innovations": ["innovation1", "innovation2", "innovation3"],
  "potential_applications": ["application1", "application2"],
  "competitive_landscape": "Who are the key players in this space? How does this patent position the assignee?",
  "strategic_recommendation": "One actionable recommendation for someone researching this patent.",
  "confidence_score": 85
}`;

    const synthesisResponse = await callGemini(synthesisPrompt);
    const synthesis = parseGeminiJSON<{
      claims_summary: string;
      key_innovations: string[];
      potential_applications: string[];
      competitive_landscape: string;
      strategic_recommendation: string;
      confidence_score: number;
    }>(synthesisResponse);

    const elapsed = Date.now() - startTime;
    console.log(`[AI Pipeline] Step 3 complete. Total time: ${elapsed}ms, confidence: ${synthesis.confidence_score}%`);

    // ========================================================================
    // COMBINE RESULTS - Merge all steps into final response
    // ========================================================================
    const result: AIAnalysisResult = {
      patent_id,
      analysis_type: "full",
      powered_by: "Gemini 3",
      claims_summary: synthesis.claims_summary,
      technical_scope: analysis.technical_scope,
      key_innovations: synthesis.key_innovations,
      potential_applications: synthesis.potential_applications,
      fto_considerations: `[${analysis.fto_risk_level} RISK] ${analysis.fto_considerations}`,
      competitive_landscape: synthesis.competitive_landscape,
      generated_at: new Date().toISOString(),
    };

    console.log(`[AI Pipeline] Multi-step analysis completed for ${patent_id} in ${elapsed}ms (3 Gemini calls)`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[AI Pipeline] Error in 3-step pipeline:", error);
    console.log("[AI Pipeline] Falling back to single-prompt mode...");

    // FALLBACK: Single-prompt mode for robustness
    try {
      const fallbackPrompt = `You are a patent intelligence analyst. Analyze this patent and provide structured analysis.

PATENT:
- ID: ${patent_id}
- Title: ${patent_title}
- Abstract: ${patent_abstract.substring(0, 1500)}

Return JSON ONLY:
{
  "claims_summary": "2-3 sentence plain-language summary of what this patent protects",
  "technical_scope": "Technical domain and scope of protection",
  "key_innovations": ["innovation1", "innovation2", "innovation3"],
  "potential_applications": ["application1", "application2"],
  "fto_considerations": "What activities might require a license?",
  "competitive_landscape": "Who are likely competitors?"
}`;

      const fallbackResponse = await callGemini(fallbackPrompt);
      const fallbackAnalysis = parseGeminiJSON<{
        claims_summary: string;
        technical_scope: string;
        key_innovations: string[];
        potential_applications: string[];
        fto_considerations: string;
        competitive_landscape: string;
      }>(fallbackResponse);

      const fallbackResult: AIAnalysisResult = {
        patent_id,
        analysis_type: "full",
        powered_by: "Gemini 3",
        claims_summary: fallbackAnalysis.claims_summary,
        technical_scope: fallbackAnalysis.technical_scope,
        key_innovations: fallbackAnalysis.key_innovations,
        potential_applications: fallbackAnalysis.potential_applications,
        fto_considerations: fallbackAnalysis.fto_considerations,
        competitive_landscape: fallbackAnalysis.competitive_landscape,
        generated_at: new Date().toISOString(),
      };

      console.log(`[AI Pipeline] Fallback succeeded for ${patent_id}`);
      return new Response(
        JSON.stringify(fallbackResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fallbackError) {
      console.error("[AI Pipeline] Fallback also failed:", fallbackError);
      return new Response(
        JSON.stringify({
          patent_id,
          available: false,
          error: "AI analysis temporarily unavailable. Please try again in a moment.",
          powered_by: "Gemini 3",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
}

/**
 * Handle AI Patent Comparison - Multi-step orchestration for comparing multiple patents
 * This demonstrates multi-step AI orchestration vs simple prompt wrapper
 */
async function handleAICompare(body: AICompareQuery): Promise<Response> {
  // INPUT VALIDATION - Required array
  if (!body.patents || !Array.isArray(body.patents)) {
    return new Response(
      JSON.stringify({ error: "patents array required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // VALIDATION - Minimum 2 patents for comparison
  if (body.patents.length < 2) {
    return new Response(
      JSON.stringify({ error: "Minimum 2 patents required for comparison" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // VALIDATION - Maximum 5 patents (rate limit protection)
  if (body.patents.length > 5) {
    return new Response(
      JSON.stringify({ error: "Maximum 5 patents allowed per comparison (rate limit protection)" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // VALIDATION - Each patent must have required fields
  for (const p of body.patents) {
    if (!p.patent_id || !p.patent_title || !p.patent_abstract) {
      return new Response(
        JSON.stringify({ error: "Each patent requires patent_id, patent_title, and patent_abstract" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    return new Response(
      JSON.stringify({
        available: false,
        reason: "AI comparison not configured",
        powered_by: "Gemini 3",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`AI Comparison requested for ${body.patents.length} patents: ${body.patents.map(p => p.patent_id).join(", ")}`);

  try {
    // STEP 1: Prepare patent summaries for comparison
    const patentSummaries = body.patents.map((p, i) =>
      `PATENT ${i + 1}: ${p.patent_id}
Title: ${p.patent_title}
Assignee: ${p.assignee || "Unknown"}
Abstract: ${p.patent_abstract.substring(0, 500)}`
    ).join("\n\n");

    // STEP 2: Call Gemini with structured comparison prompt
    const prompt = `You are a patent analyst comparing multiple patents. Analyze the overlaps, differences, and freedom-to-operate implications.

${patentSummaries}

Provide analysis in JSON format ONLY (no markdown, no explanation):
{
  "overlap_analysis": "Brief description of what technical areas these patents share in common",
  "differentiation_matrix": [
    {"patent_id": "...", "unique_aspects": ["aspect1", "aspect2"], "shared_with": ["other_patent_ids"]}
  ],
  "fto_summary": "Freedom-to-operate considerations when all these patents are in scope. Note: This is not legal advice.",
  "recommendation": "One-sentence strategic recommendation for someone researching this space"
}`;

    const geminiResponse = await callGemini(prompt);

    // STEP 3: Parse and validate response
    const analysis = parseGeminiJSON<{
      overlap_analysis: string;
      differentiation_matrix: Array<{ patent_id: string; unique_aspects: string[]; shared_with: string[] }>;
      fto_summary: string;
      recommendation: string;
    }>(geminiResponse);

    const result: AICompareResult = {
      comparison_type: "multi_patent",
      powered_by: "Gemini 3",
      patent_ids: body.patents.map(p => p.patent_id),
      overlap_analysis: analysis.overlap_analysis,
      differentiation_matrix: analysis.differentiation_matrix,
      fto_summary: analysis.fto_summary,
      recommendation: analysis.recommendation,
      generated_at: new Date().toISOString(),
    };

    console.log(`AI Comparison completed for ${body.patents.length} patents`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Comparison error:", error);
    return new Response(
      JSON.stringify({
        available: false,
        error: "AI comparison failed. Please try again.",
        powered_by: "Gemini 3",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handle Query Expansion - AI expands user search queries for better patent discovery
 */
async function handleQueryExpand(body: QueryExpandQuery): Promise<Response> {
  // INPUT VALIDATION - Query required
  if (!body.query || body.query.trim().length < 2) {
    return new Response(
      JSON.stringify({ error: "Query must be at least 2 characters" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Sanitize and limit query length to prevent prompt injection
  const sanitizedQuery = body.query.trim().substring(0, 200);

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    // Graceful degradation - return empty expansion
    return new Response(
      JSON.stringify({
        original_query: sanitizedQuery,
        expanded_terms: [],
        technical_synonyms: [],
        suggested_cpc_codes: [],
        reasoning: "AI expansion not available",
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`Query expansion requested for: "${sanitizedQuery}"`);

  try {
    const prompt = `You are a patent search expert. Given this search query, suggest technical synonyms and related terms for better patent discovery.

Query: "${sanitizedQuery}"

Return JSON only (no markdown, no explanation):
{
  "expanded_terms": ["term1", "term2", "term3"],
  "technical_synonyms": ["synonym1", "synonym2"],
  "suggested_cpc_codes": ["H04L", "G06F"],
  "reasoning": "One sentence explaining the expansion logic"
}

Keep lists to max 5 items each. Focus on USPTO/patent terminology.`;

    const geminiResponse = await callGemini(prompt);
    const expansion = parseGeminiJSON<{
      expanded_terms: string[];
      technical_synonyms: string[];
      suggested_cpc_codes: string[];
      reasoning: string;
    }>(geminiResponse);

    console.log(`Query expansion completed for: "${sanitizedQuery}"`);

    return new Response(
      JSON.stringify({
        original_query: sanitizedQuery,
        expanded_terms: expansion.expanded_terms || [],
        technical_synonyms: expansion.technical_synonyms || [],
        suggested_cpc_codes: expansion.suggested_cpc_codes || [],
        reasoning: expansion.reasoning || "",
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Query expansion error:", error);
    // Graceful degradation - return empty expansion on error
    return new Response(
      JSON.stringify({
        original_query: sanitizedQuery,
        expanded_terms: [],
        technical_synonyms: [],
        suggested_cpc_codes: [],
        reasoning: "Expansion unavailable",
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handle AI Claim Graph - Parse patent claims and identify dependencies
 * Uses Gemini to analyze claim structure and generate a dependency graph
 */
async function handleClaimGraph(body: ClaimGraphQuery): Promise<Response> {
  const { patent_id, patent_title, patent_abstract, claims_text } = body;

  if (!patent_id || !patent_title) {
    return new Response(
      JSON.stringify({ error: "patent_id and patent_title are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    return new Response(
      JSON.stringify({
        patent_id,
        available: false,
        reason: "Gemini AI not configured. Set GEMINI_API_KEY in Supabase secrets.",
        powered_by: "Gemini 3",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[Claim Graph] Starting analysis for patent: ${patent_id}`);

  try {
    const prompt = `You are a patent claim analyst. Analyze the following patent and extract the claim structure.

PATENT DATA:
- ID: ${patent_id}
- Title: ${patent_title}
- Abstract: ${patent_abstract.substring(0, 1500)}
${claims_text ? `- Claims Text: ${claims_text.substring(0, 3000)}` : ""}

INSTRUCTIONS:
1. Identify each claim by its number
2. Determine if each claim is "independent" (stands alone) or "dependent" (references another claim)
3. For dependent claims, identify which claim number(s) they depend on
4. Extract a 1-sentence essence summarizing what each claim protects
5. List key elements/limitations for each claim (technical features, components, steps)

If no explicit claims text is provided, infer likely claim structure from the title and abstract.

Return JSON ONLY (no markdown, no explanation):
{
  "claims": [
    {
      "claim_id": 1,
      "type": "independent",
      "depends_on": [],
      "essence": "One sentence describing what this claim protects",
      "key_elements": ["element1", "element2", "element3"]
    },
    {
      "claim_id": 2,
      "type": "dependent",
      "depends_on": [1],
      "essence": "One sentence describing the additional limitation",
      "key_elements": ["additional_element"]
    }
  ]
}

Rules:
- claim_id must be a number
- type must be exactly "independent" or "dependent"
- depends_on is an array of claim numbers (empty for independent claims)
- essence should be one clear, concise sentence
- key_elements should have 1-5 items per claim`;

    const geminiResponse = await callGemini(prompt);
    const parsed = parseGeminiJSON<{
      claims: Array<{
        claim_id: number;
        type: "independent" | "dependent";
        depends_on: number[];
        essence: string;
        key_elements: string[];
      }>;
    }>(geminiResponse);

    const result: ClaimGraphResult = {
      patent_id,
      powered_by: "Gemini 3",
      claims: parsed.claims || [],
      generated_at: new Date().toISOString(),
    };

    console.log(`[Claim Graph] Analysis completed for ${patent_id}: ${result.claims.length} claims identified`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Claim Graph] Error:", error);
    return new Response(
      JSON.stringify({
        patent_id,
        available: false,
        error: "Claim graph analysis failed. Please try again.",
        powered_by: "Gemini 3",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// Inventor Network Analysis - Collaboration patterns between inventors
// ============================================================================

interface PatentsViewInventorPatent {
  patent_id: string;
  patent_title?: string;
  patent_date?: string;
  inventors?: Array<{
    inventor_first_name: string;
    inventor_last_name: string;
    inventor_id?: string;
  }>;
  assignees?: Array<{
    assignee_organization: string;
  }>;
  cpcs?: Array<{
    cpc_group_id: string;
    cpc_group_title?: string;
  }>;
}

async function handleInventorNetwork(body: InventorNetworkQuery): Promise<Response> {
  const { inventor_name, assignee, patent_ids, limit = 50 } = body;

  if (!inventor_name && !assignee && (!patent_ids || patent_ids.length === 0)) {
    return new Response(
      JSON.stringify({ error: "At least one of inventor_name, assignee, or patent_ids is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const patentsViewApiKey = Deno.env.get("PATENTSVIEW_API_KEY");
  if (!patentsViewApiKey) {
    return new Response(
      JSON.stringify({ error: "PATENTSVIEW_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[Inventor Network] Starting analysis - inventor: ${inventor_name}, assignee: ${assignee}, patent_ids: ${patent_ids?.length || 0}`);

  try {
    let patents: PatentsViewInventorPatent[] = [];

    // Build query based on input
    if (patent_ids && patent_ids.length > 0) {
      // Fetch specific patents
      const patentQuery = {
        patent_id: patent_ids.map(id => id.replace(/^US/, "")),
      };
      const queryString = JSON.stringify(patentQuery);
      const url = `https://api.patentsview.org/patents/query?q=${encodeURIComponent(queryString)}&f=["patent_id","patent_title","patent_date","inventors","assignees","cpcs"]&o={"per_page":${Math.min(patent_ids.length, 100)}}`;

      const response = await fetch(url, {
        headers: { "X-Api-Key": patentsViewApiKey },
      });

      if (response.ok) {
        const data = await response.json();
        patents = data.patents || [];
      }
    } else if (inventor_name) {
      // Find patents by inventor name
      const nameParts = inventor_name.trim().split(/\s+/);
      const lastName = nameParts.pop() || "";
      const firstName = nameParts.join(" ") || "";

      const inventorQuery = firstName
        ? { _and: [{ inventor_last_name: lastName }, { inventor_first_name: firstName }] }
        : { inventor_last_name: inventor_name };

      const queryString = JSON.stringify(inventorQuery);
      const url = `https://api.patentsview.org/patents/query?q=${encodeURIComponent(queryString)}&f=["patent_id","patent_title","patent_date","inventors","assignees","cpcs"]&o={"per_page":${Math.min(limit, 100)},"sort":[{"patent_date":"desc"}]}`;

      const response = await fetch(url, {
        headers: { "X-Api-Key": patentsViewApiKey },
      });

      if (response.ok) {
        const data = await response.json();
        patents = data.patents || [];
      }
    } else if (assignee) {
      // Find top inventors for assignee
      const assigneeQuery = { _contains: { assignee_organization: assignee } };
      const queryString = JSON.stringify(assigneeQuery);
      const url = `https://api.patentsview.org/patents/query?q=${encodeURIComponent(queryString)}&f=["patent_id","patent_title","patent_date","inventors","assignees","cpcs"]&o={"per_page":${Math.min(limit, 100)},"sort":[{"patent_date":"desc"}]}`;

      const response = await fetch(url, {
        headers: { "X-Api-Key": patentsViewApiKey },
      });

      if (response.ok) {
        const data = await response.json();
        patents = data.patents || [];
      }
    }

    if (patents.length === 0) {
      return new Response(
        JSON.stringify({
          nodes: [],
          edges: [],
          clusters: [],
          stats: { total_inventors: 0, total_collaborations: 0, most_connected_inventor: "" },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build inventor map: inventor_id -> { name, patents, assignees, cpcs }
    const inventorMap = new Map<string, {
      name: string;
      patents: Set<string>;
      assignees: Map<string, number>;
      cpcs: Map<string, number>;
    }>();

    // Build co-authorship edges: "id1|id2" -> { patents }
    const edgeMap = new Map<string, Set<string>>();

    for (const patent of patents) {
      const inventors = patent.inventors || [];
      const patentId = patent.patent_id;
      const primaryAssignee = patent.assignees?.[0]?.assignee_organization || "";
      const cpcCodes = patent.cpcs?.map(c => c.cpc_group_id) || [];

      // Add each inventor to the map
      for (const inv of inventors) {
        const invId = inv.inventor_id || `${inv.inventor_first_name}_${inv.inventor_last_name}`.toLowerCase().replace(/\s+/g, "_");
        const invName = `${inv.inventor_first_name} ${inv.inventor_last_name}`;

        if (!inventorMap.has(invId)) {
          inventorMap.set(invId, {
            name: invName,
            patents: new Set(),
            assignees: new Map(),
            cpcs: new Map(),
          });
        }

        const invData = inventorMap.get(invId)!;
        invData.patents.add(patentId);

        if (primaryAssignee) {
          invData.assignees.set(primaryAssignee, (invData.assignees.get(primaryAssignee) || 0) + 1);
        }

        for (const cpc of cpcCodes) {
          invData.cpcs.set(cpc, (invData.cpcs.get(cpc) || 0) + 1);
        }
      }

      // Build edges for co-inventors
      for (let i = 0; i < inventors.length; i++) {
        for (let j = i + 1; j < inventors.length; j++) {
          const id1 = inventors[i].inventor_id || `${inventors[i].inventor_first_name}_${inventors[i].inventor_last_name}`.toLowerCase().replace(/\s+/g, "_");
          const id2 = inventors[j].inventor_id || `${inventors[j].inventor_first_name}_${inventors[j].inventor_last_name}`.toLowerCase().replace(/\s+/g, "_");

          const edgeKey = [id1, id2].sort().join("|");
          if (!edgeMap.has(edgeKey)) {
            edgeMap.set(edgeKey, new Set());
          }
          edgeMap.get(edgeKey)!.add(patentId);
        }
      }
    }

    // Build nodes
    const nodes: InventorNetworkResult["nodes"] = [];
    for (const [id, data] of inventorMap) {
      // Find primary assignee (most frequent)
      let primaryAssignee: string | undefined;
      let maxCount = 0;
      for (const [org, count] of data.assignees) {
        if (count > maxCount) {
          maxCount = count;
          primaryAssignee = org;
        }
      }

      // Find top expertise areas (top 3 CPC codes)
      const sortedCpcs = [...data.cpcs.entries()].sort((a, b) => b[1] - a[1]);
      const expertiseAreas = sortedCpcs.slice(0, 3).map(([cpc]) => cpc);

      nodes.push({
        id,
        name: data.name,
        patent_count: data.patents.size,
        primary_assignee: primaryAssignee,
        expertise_areas: expertiseAreas,
      });
    }

    // Build edges
    const edges: InventorNetworkResult["edges"] = [];
    for (const [edgeKey, patentSet] of edgeMap) {
      const [source, target] = edgeKey.split("|");
      edges.push({
        source,
        target,
        weight: patentSet.size,
        patents: [...patentSet],
      });
    }

    // Identify clusters using simple connected components + assignee grouping
    const clusters: InventorNetworkResult["clusters"] = [];
    const assigneeClusters = new Map<string, Set<string>>();

    for (const node of nodes) {
      if (node.primary_assignee) {
        if (!assigneeClusters.has(node.primary_assignee)) {
          assigneeClusters.set(node.primary_assignee, new Set());
        }
        assigneeClusters.get(node.primary_assignee)!.add(node.id);
      }
    }

    let clusterIndex = 0;
    for (const [org, inventorIds] of assigneeClusters) {
      if (inventorIds.size >= 2) {
        // Determine focus area from most common CPC across cluster members
        const clusterCpcs = new Map<string, number>();
        for (const invId of inventorIds) {
          const invData = inventorMap.get(invId);
          if (invData) {
            for (const [cpc, count] of invData.cpcs) {
              clusterCpcs.set(cpc, (clusterCpcs.get(cpc) || 0) + count);
            }
          }
        }
        const topCpc = [...clusterCpcs.entries()].sort((a, b) => b[1] - a[1])[0];

        clusters.push({
          id: `cluster_${clusterIndex++}`,
          inventors: [...inventorIds],
          common_assignee: org,
          focus_area: topCpc ? topCpc[0] : "General",
        });
      }
    }

    // Calculate stats
    let mostConnectedInventor = "";
    let maxConnections = 0;
    const connectionCounts = new Map<string, number>();

    for (const edge of edges) {
      connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + edge.weight);
      connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + edge.weight);
    }

    for (const [invId, count] of connectionCounts) {
      if (count > maxConnections) {
        maxConnections = count;
        mostConnectedInventor = inventorMap.get(invId)?.name || invId;
      }
    }

    const result: InventorNetworkResult = {
      nodes,
      edges,
      clusters,
      stats: {
        total_inventors: nodes.length,
        total_collaborations: edges.length,
        most_connected_inventor: mostConnectedInventor,
      },
    };

    console.log(`[Inventor Network] Analysis complete: ${nodes.length} inventors, ${edges.length} collaborations, ${clusters.length} clusters`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Inventor Network] Error:", error);
    return new Response(
      JSON.stringify({ error: `Inventor network analysis failed: ${(error as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handle AI Portfolio Valuation - Score patents by strategic value
 * Uses multi-step Gemini analysis to evaluate patent portfolio worth
 */
async function handlePortfolioValue(body: PortfolioValueQuery): Promise<Response> {
  const { patents } = body;

  if (!patents || !Array.isArray(patents)) {
    return new Response(
      JSON.stringify({ error: "patents array required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (patents.length < 1) {
    return new Response(
      JSON.stringify({ error: "Minimum 1 patent required for valuation" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (patents.length > 20) {
    return new Response(
      JSON.stringify({ error: "Maximum 20 patents allowed per valuation request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  for (const p of patents) {
    if (!p.patent_id || !p.patent_title || !p.patent_abstract) {
      return new Response(
        JSON.stringify({ error: "Each patent requires patent_id, patent_title, and patent_abstract" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    return new Response(
      JSON.stringify({
        available: false,
        reason: "Gemini AI not configured. Set GEMINI_API_KEY in Supabase secrets.",
        powered_by: "Gemini 3",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[Portfolio Value] Starting valuation for ${patents.length} patents`);
  const startTime = Date.now();

  try {
    // ========================================================================
    // STEP 0 (NEW): ENRICH - Fetch commercialization signals from Exa
    // ========================================================================
    console.log(`[Portfolio Value] Step 0: Fetching commercialization context from Exa`);

    let commercializationContext: EnrichmentArticle[] = [];
    try {
      // Use first assignee's name to search for product launches, licensing deals
      const topAssignee = patents.find(p => p.assignee)?.assignee || '';
      const commercialQuery = topAssignee
        ? `${topAssignee} patent licensing product launch commercialization`
        : `patent portfolio valuation licensing deals`;

      commercializationContext = await queryExaForEnrichment(commercialQuery, 5);
      console.log(`[Portfolio Value] Exa returned ${commercializationContext.length} commercialization articles`);
    } catch (exaError) {
      console.warn(`[Portfolio Value] Exa enrichment failed, continuing without:`, exaError);
    }

    // ========================================================================
    // STEP 1: Process patent summaries for valuation analysis
    // ========================================================================
    const patentSummaries = patents.map((p, i) => {
      const remainingYears = p.expiration_date
        ? Math.max(0, Math.floor((new Date(p.expiration_date).getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000)))
        : "unknown";
      return `PATENT ${i + 1}: ${p.patent_id}
Title: ${p.patent_title}
Abstract: ${p.patent_abstract.substring(0, 400)}
Assignee: ${p.assignee || "Unknown"}
Filing Date: ${p.filing_date || "Unknown"}
Remaining Life: ${remainingYears} years
Citation Count: ${p.citation_count ?? "Unknown"}`;
    }).join("\n\n");

    const prompt = `You are a patent valuation expert. Analyze each patent in this portfolio and score them on multiple dimensions.

${patentSummaries}

${commercializationContext.length > 0 ? `COMMERCIALIZATION CONTEXT (from Exa - for market insight):
${commercializationContext.map(a => `- "${a.title}" (${a.source || 'web'}): ${a.snippet.substring(0, 150)}`).join('\n')}

` : ''}IMPORTANT: Base ALL valuations ONLY on the patent data provided.
Use commercialization context for market insight but do not invent product details.

For each patent, score on a 0-100 scale:
- innovation_score: How novel and inventive is the technology?
- market_relevance_score: How commercially valuable in current markets?
- remaining_life_score: Based on patent term remaining (more years = higher score)
- claim_breadth_score: How broad is the likely scope of protection?

Calculate overall_score as weighted average: (innovation*0.3 + market*0.3 + life*0.2 + breadth*0.2)

Return JSON ONLY (no markdown, no explanation):
{
  "patent_scores": [
    {
      "patent_id": "...",
      "overall_score": 75,
      "innovation_score": 80,
      "market_relevance_score": 70,
      "remaining_life_score": 85,
      "claim_breadth_score": 65,
      "value_drivers": ["driver1", "driver2"],
      "risks": ["risk1", "risk2"]
    }
  ],
  "strategic_insights": ["insight1", "insight2", "insight3"]
}

Rules:
- All scores must be integers 0-100
- value_drivers: 2-4 key factors that make this patent valuable
- risks: 1-3 potential concerns (expiration, narrow claims, crowded field, etc.)
- strategic_insights: 2-4 portfolio-level observations and recommendations`;

    const geminiResponse = await callGemini(prompt);
    const analysis = parseGeminiJSON<{
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
    }>(geminiResponse);

    const scores = analysis.patent_scores || [];
    const totalPatents = scores.length;
    const averageScore = totalPatents > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.overall_score, 0) / totalPatents)
      : 0;

    const highestValuePatent = scores.length > 0
      ? scores.reduce((max, s) => s.overall_score > max.overall_score ? s : max).patent_id
      : "";

    let portfolioStrength: "WEAK" | "MODERATE" | "STRONG" | "EXCEPTIONAL";
    if (averageScore >= 80) {
      portfolioStrength = "EXCEPTIONAL";
    } else if (averageScore >= 65) {
      portfolioStrength = "STRONG";
    } else if (averageScore >= 45) {
      portfolioStrength = "MODERATE";
    } else {
      portfolioStrength = "WEAK";
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Portfolio Value] Valuation completed in ${elapsed}ms: ${totalPatents} patents, avg score ${averageScore}`);

    const result: PortfolioValueResult = {
      powered_by: "Gemini 3",
      portfolio_summary: {
        total_patents: totalPatents,
        average_score: averageScore,
        highest_value_patent: highestValuePatent,
        portfolio_strength: portfolioStrength,
      },
      patent_scores: scores,
      strategic_insights: analysis.strategic_insights || [],
      generated_at: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Portfolio Value] Error:", error);
    return new Response(
      JSON.stringify({
        available: false,
        error: "Portfolio valuation failed. Please try again.",
        powered_by: "Gemini 3",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handle AI FTO (Freedom to Operate) Analysis
 * 
 * MULTI-STEP ORCHESTRATION PATTERN:
 * Step 1: Extract key technical elements from product description
 * Step 2: For each patent, analyze overlap and generate risk assessment
 * Aggregates into final result with overall risk score
 */
async function handleFTOAnalyze(body: FTOAnalyzeQuery): Promise<Response> {
  const { product_description, patents } = body;

  if (!product_description || product_description.trim().length < 10) {
    return new Response(
      JSON.stringify({ error: "product_description must be at least 10 characters" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!patents || !Array.isArray(patents) || patents.length < 1) {
    return new Response(
      JSON.stringify({ error: "At least 1 patent is required for FTO analysis" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (patents.length > 10) {
    return new Response(
      JSON.stringify({ error: "Maximum 10 patents allowed per FTO analysis (rate limit protection)" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  for (const p of patents) {
    if (!p.patent_id || !p.patent_title || !p.patent_abstract) {
      return new Response(
        JSON.stringify({ error: "Each patent requires patent_id, patent_title, and patent_abstract" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    return new Response(
      JSON.stringify({
        available: false,
        reason: "Gemini AI not configured. Set GEMINI_API_KEY in Supabase secrets.",
        powered_by: "Gemini 3",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[FTO Analysis] Starting 2-step analysis for ${patents.length} patents`);
  const startTime = Date.now();

  try {
    // ========================================================================
    // STEP 1: EXTRACT - Pull key technical elements from product description
    // ========================================================================
    console.log(`[FTO Analysis] Step 1/2: Extracting product technical elements`);
    const extractionPrompt = `You are a patent infringement analyst. Extract key technical elements from this product/invention description that could potentially overlap with patent claims.

PRODUCT/INVENTION DESCRIPTION:
${product_description.substring(0, 2000)}

Extract and return JSON ONLY:
{
  "product_summary": "2-3 sentence summary of the product/invention in technical terms",
  "key_technical_elements": ["element1", "element2", "element3", "element4", "element5"],
  "technology_domains": ["domain1", "domain2"],
  "implementation_methods": ["method1", "method2"]
}

Focus on specific technical features, components, methods, and processes that would be relevant for patent claim comparison.`;

    const extractionResponse = await callGemini(extractionPrompt);
    const extraction = parseGeminiJSON<{
      product_summary: string;
      key_technical_elements: string[];
      technology_domains: string[];
      implementation_methods: string[];
    }>(extractionResponse);

    console.log(`[FTO Analysis] Step 1 complete: ${extraction.key_technical_elements.length} elements extracted`);

    // ========================================================================
    // STEP 1.5 (NEW): ENRICH - Fetch litigation/infringement context from Exa
    // ========================================================================
    console.log(`[FTO Analysis] Step 1.5: Fetching litigation context from Exa`);

    let litigationContext: EnrichmentArticle[] = [];
    try {
      // Search for litigation history related to patent assignees
      const assigneeNames = patents.map(p => p.assignee).filter(Boolean).slice(0, 3);
      const litigationQuery = assigneeNames.length > 0
        ? `${assigneeNames[0]} patent infringement lawsuit litigation`
        : `${extraction.technology_domains[0] || 'technology'} patent litigation`;

      litigationContext = await queryExaForEnrichment(litigationQuery, 5);
      console.log(`[FTO Analysis] Exa returned ${litigationContext.length} litigation articles`);
    } catch (exaError) {
      console.warn(`[FTO Analysis] Exa enrichment failed, continuing without:`, exaError);
    }

    // ========================================================================
    // STEP 2: ANALYZE - For each patent, analyze overlap and risk with context
    // ========================================================================
    console.log(`[FTO Analysis] Step 2/2: Analyzing ${patents.length} patents for infringement risk`);

    const patentSummaries = patents.map((p, i) =>
      `PATENT ${i + 1}: ${p.patent_id}
Title: ${p.patent_title}
Abstract: ${p.patent_abstract.substring(0, 500)}
${p.claims_text ? `Claims: ${p.claims_text.substring(0, 500)}` : ""}`
    ).join("\n\n");

    const analysisPrompt = `You are a patent infringement analyst. Analyze the risk of the described product infringing on these patents.

PRODUCT TECHNICAL PROFILE:
- Summary: ${extraction.product_summary}
- Key Elements: ${extraction.key_technical_elements.join(", ")}
- Domains: ${extraction.technology_domains.join(", ")}
- Methods: ${extraction.implementation_methods.join(", ")}

PATENTS TO ANALYZE:
${patentSummaries}

${litigationContext.length > 0 ? `LITIGATION CONTEXT (from Exa - for risk assessment):
${litigationContext.map(a => `- "${a.title}" (${a.source || 'web'}): ${a.snippet.substring(0, 150)}`).join('\n')}

` : ''}For each patent, assess:
1. Which product elements overlap with patent claims
2. Which elements do NOT overlap (freedom areas)
3. Possible design-arounds to avoid infringement
4. Confidence level (0-100) in the assessment

IMPORTANT: Base ALL assessments ONLY on the patent data provided above.
Consider litigation context for risk level assessment but DO NOT invent case details.

Return JSON ONLY:
{
  "patent_risks": [
    {
      "patent_id": "patent_id_here",
      "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
      "overlapping_elements": ["element1", "element2"],
      "non_overlapping_elements": ["element3"],
      "design_around_suggestions": ["suggestion1", "suggestion2"],
      "confidence": 75
    }
  ],
  "overall_risk": "LOW|MEDIUM|HIGH|CRITICAL",
  "strategic_recommendations": ["recommendation1", "recommendation2", "recommendation3"]
}

Risk Level Guidelines:
- LOW: Minimal claim overlap, clear design-around options exist
- MEDIUM: Some claim overlap but significant non-overlapping elements
- HIGH: Substantial claim overlap, limited design-around options
- CRITICAL: Core product elements directly overlap with key patent claims

Note: This is a preliminary analysis for research purposes only, not legal advice.`;

    const analysisResponse = await callGemini(analysisPrompt);
    const analysis = parseGeminiJSON<{
      patent_risks: Array<{
        patent_id: string;
        risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        overlapping_elements: string[];
        non_overlapping_elements: string[];
        design_around_suggestions: string[];
        confidence: number;
      }>;
      overall_risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      strategic_recommendations: string[];
    }>(analysisResponse);

    const elapsed = Date.now() - startTime;
    console.log(`[FTO Analysis] Step 2 complete. Total time: ${elapsed}ms, overall risk: ${analysis.overall_risk}`);

    // ========================================================================
    // COMBINE RESULTS - Merge extraction and analysis into final response
    // ========================================================================
    const result: FTOAnalysisResult = {
      powered_by: "Gemini 3",
      product_summary: extraction.product_summary,
      overall_risk: analysis.overall_risk,
      patent_risks: analysis.patent_risks,
      strategic_recommendations: analysis.strategic_recommendations,
      generated_at: new Date().toISOString(),
    };

    console.log(`[FTO Analysis] Multi-step analysis completed for ${patents.length} patents in ${elapsed}ms (2 Gemini calls)`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[FTO Analysis] Error in 2-step pipeline:", error);
    return new Response(
      JSON.stringify({
        available: false,
        error: "FTO analysis is temporarily unavailable. Please try again later.",
        product_summary: "",
        overall_risk: "UNKNOWN",
        patent_risks: [],
        strategic_recommendations: [],
        powered_by: "Gemini 3",
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handle AI Prior Art Discovery - Autonomous multi-step agent for finding prior art
 * 
 * MULTI-STEP ORCHESTRATION PATTERN:
 * Step 1: EXTRACT - Identify novel elements and generate search strategy
 * Step 2: SEARCH - Query PatentsView for candidate patents filed BEFORE target
 * Step 3: EVALUATE - Use Gemini to score relevance of each candidate
 */
async function handlePriorArt(body: PriorArtQuery): Promise<Response> {
  const { patent_id, patent_title, patent_abstract, claims_text, filing_date } = body;

  if (!patent_id || !patent_title || !patent_abstract) {
    return new Response(
      JSON.stringify({ error: "patent_id, patent_title, and patent_abstract are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  const patentsviewApiKey = Deno.env.get("PATENTSVIEW_API_KEY");

  if (!geminiApiKey) {
    return new Response(
      JSON.stringify({
        patent_id,
        available: false,
        reason: "Gemini AI not configured. Set GEMINI_API_KEY in Supabase secrets.",
        powered_by: "Gemini 3",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!patentsviewApiKey) {
    return new Response(
      JSON.stringify({
        patent_id,
        available: false,
        reason: "PatentsView API not configured. Set PATENTSVIEW_API_KEY in Supabase secrets.",
        powered_by: "Gemini 3",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const beforeDate = filing_date || new Date().toISOString().split("T")[0];

  console.log(`[Prior Art Agent] Starting discovery for patent: ${patent_id}, searching before: ${beforeDate}`);
  const startTime = Date.now();

  try {
    // ========================================================================
    // STEP 1: EXTRACT - Identify novel elements and generate search strategy
    // ========================================================================
    console.log(`[Prior Art Agent] Step 1/3: Extracting novel elements and search strategy`);

    const extractionPrompt = `You are a patent prior art search specialist. Analyze this patent and generate an optimal search strategy for finding prior art.

PATENT DATA:
- ID: ${patent_id}
- Title: ${patent_title}
- Abstract: ${patent_abstract.substring(0, 2000)}
${claims_text ? `- Claims: ${claims_text.substring(0, 2000)}` : ""}

TASK:
1. Identify the KEY NOVEL CONCEPTS that define this invention
2. Generate SEARCH KEYWORDS that would find similar prior inventions
3. Suggest CPC classification codes that would cover this technology area

Return JSON ONLY (no markdown, no explanation):
{
  "key_concepts": ["concept1", "concept2", "concept3", "concept4", "concept5"],
  "search_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "cpc_codes": ["H04L", "G06F", "A61B"],
  "technical_domain": "Brief description of the technical field",
  "novelty_focus": "What makes this patent unique that prior art might challenge?"
}

Rules:
- key_concepts: 3-5 core technical concepts from the invention
- search_keywords: 5-8 keywords/phrases for patent search (use patent terminology)
- cpc_codes: 2-4 relevant CPC codes (just the main group, e.g., "H04L" not "H04L29/06")`;

    const extractionResponse = await callGemini(extractionPrompt);
    const extraction = parseGeminiJSON<{
      key_concepts: string[];
      search_keywords: string[];
      cpc_codes: string[];
      technical_domain: string;
      novelty_focus: string;
    }>(extractionResponse);

    console.log(`[Prior Art Agent] Step 1 complete: ${extraction.key_concepts.length} concepts, ${extraction.search_keywords.length} keywords`);

    // ========================================================================
    // STEP 2: SEARCH - Query PatentsView for candidate patents filed BEFORE target
    // ========================================================================
    console.log(`[Prior Art Agent] Step 2/3: Searching PatentsView for candidates`);

    const searchQuery = extraction.search_keywords.slice(0, 3).join(" ");
    const apiUrl = "https://search.patentsview.org/api/v1/patent/";

    const requestBody: Record<string, unknown> = {
      q: {
        "_and": [
          { "_text_any": { "patent_title": searchQuery } },
          { "_lt": { "patent_date": beforeDate } }
        ]
      },
      f: [
        "patent_id",
        "patent_title",
        "patent_abstract",
        "patent_date",
        "patent_type",
        "assignees",
        "cpc_current"
      ],
      o: {
        "size": 25
      },
      s: [{ "patent_date": "desc" }]
    };

    console.log(`[Prior Art Agent] PatentsView query: "${searchQuery}" before ${beforeDate}`);

    const searchResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": patentsviewApiKey
      },
      body: JSON.stringify(requestBody),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("[Prior Art Agent] PatentsView error:", searchResponse.status, errorText);
      throw new Error(`PatentsView API error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const candidatePatents = searchData.patents || [];

    console.log(`[Prior Art Agent] Step 2 complete: Found ${candidatePatents.length} candidate patents`);

    if (candidatePatents.length === 0) {
      const result: PriorArtResult = {
        powered_by: "Gemini 3",
        target_patent: patent_id,
        key_concepts: extraction.key_concepts,
        search_strategy: {
          keywords: extraction.search_keywords,
          cpc_codes: extraction.cpc_codes,
          date_range: { before: beforeDate }
        },
        prior_art_candidates: [],
        analysis_summary: "No prior art candidates found in the PatentsView database matching the search criteria. Consider broadening search terms or exploring non-patent literature.",
        generated_at: new Date().toISOString(),
      };

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 2.5 (NEW): ENRICH - Fetch related research from Exa for grounding
    // ========================================================================
    console.log(`[Prior Art Agent] Step 2.5: Fetching Exa research context`);

    let exaResearchContext: EnrichmentArticle[] = [];
    try {
      exaResearchContext = await queryExaForEnrichment(
        `${extraction.search_keywords.slice(0, 3).join(' ')} prior art research`,
        5
      );
      console.log(`[Prior Art Agent] Exa returned ${exaResearchContext.length} research articles`);
    } catch (exaError) {
      console.warn(`[Prior Art Agent] Exa enrichment failed, continuing without:`, exaError);
    }

    // ========================================================================
    // STEP 3: EVALUATE - Use Gemini to score relevance with grounded context
    // ========================================================================
    console.log(`[Prior Art Agent] Step 3/3: Evaluating ${candidatePatents.length} candidates with Gemini`);

    const candidateSummaries = candidatePatents.slice(0, 15).map((p: PatentsViewPatent, i: number) =>
      `CANDIDATE ${i + 1}: ${p.patent_id}
Title: ${p.patent_title}
Date: ${p.patent_date}
Abstract: ${(p.patent_abstract || "").substring(0, 400)}`
    ).join("\n\n");

    const evaluationPrompt = `You are a patent prior art analyst. Evaluate these candidate patents as potential prior art for the target patent.

TARGET PATENT:
- ID: ${patent_id}
- Title: ${patent_title}
- Abstract: ${patent_abstract.substring(0, 1000)}
- Key Concepts: ${extraction.key_concepts.join(", ")}
- Novelty Focus: ${extraction.novelty_focus}

CANDIDATE PATENTS (from USPTO/PatentsView):
${candidateSummaries}

${exaResearchContext.length > 0 ? `RELATED RESEARCH (from Exa - for additional context only):
${exaResearchContext.map(a => `- "${a.title}" (${a.source || 'web'}): ${a.snippet.substring(0, 200)}`).join('\n')}

` : ''}TASK:
For each candidate, assess how well it anticipates or renders obvious the target patent's claims.

IMPORTANT: Only reference patent IDs that appear in the CANDIDATE PATENTS list above.
DO NOT invent or hallucinate patent numbers. All findings must be traceable to the data provided.

Return JSON ONLY (no markdown):
{
  "evaluated_candidates": [
    {
      "patent_id": "...",
      "relevance_score": 85,
      "overlap_summary": "One sentence describing the technical overlap",
      "key_matching_elements": ["element1", "element2"]
    }
  ],
  "analysis_summary": "Overall assessment of the prior art landscape and strongest challenges to the target patent"
}

Rules:
- relevance_score: 0-100 (100 = perfect anticipation, 0 = no relevance)
- Only include candidates with relevance_score >= 30
- Sort by relevance_score descending
- Return top 10 most relevant candidates
- key_matching_elements: 1-3 specific technical elements that overlap`;

    const evaluationResponse = await callGemini(evaluationPrompt);
    const evaluation = parseGeminiJSON<{
      evaluated_candidates: Array<{
        patent_id: string;
        relevance_score: number;
        overlap_summary: string;
        key_matching_elements: string[];
      }>;
      analysis_summary: string;
    }>(evaluationResponse);

    const elapsed = Date.now() - startTime;
    console.log(`[Prior Art Agent] Step 3 complete. Total time: ${elapsed}ms, ${evaluation.evaluated_candidates.length} relevant candidates found`);

    // Filter out hallucinated patent IDs - only keep candidates that actually exist in search results
    const priorArtCandidates = evaluation.evaluated_candidates
      .filter(candidate => {
        const normalizedId = candidate.patent_id.replace(/^US/i, '');
        const exists = candidatePatents.some(
          (p: PatentsViewPatent) =>
            p.patent_id === candidate.patent_id ||
            p.patent_id === normalizedId ||
            `US${p.patent_id}` === candidate.patent_id
        );
        if (!exists) {
          console.warn(`[Prior Art Agent] Filtering hallucinated patent ID: ${candidate.patent_id}`);
        }
        return exists;
      })
      .slice(0, 10)
      .map(candidate => {
        const normalizedId = candidate.patent_id.replace(/^US/i, '');
        const originalPatent = candidatePatents.find(
          (p: PatentsViewPatent) =>
            p.patent_id === candidate.patent_id ||
            p.patent_id === normalizedId ||
            `US${p.patent_id}` === candidate.patent_id
        );
        return {
          patent_id: originalPatent?.patent_id.startsWith("US") ? originalPatent.patent_id : `US${originalPatent?.patent_id || candidate.patent_id}`,
          patent_title: originalPatent?.patent_title || candidate.patent_id,
          relevance_score: Math.min(100, Math.max(0, candidate.relevance_score)), // Clamp to valid range
          overlap_summary: candidate.overlap_summary,
          key_matching_elements: candidate.key_matching_elements || [],
        };
      });

    const result: PriorArtResult & { related_research?: EnrichmentArticle[] } = {
      powered_by: "Gemini 3",
      target_patent: patent_id,
      key_concepts: extraction.key_concepts,
      search_strategy: {
        keywords: extraction.search_keywords,
        cpc_codes: extraction.cpc_codes,
        date_range: { before: beforeDate }
      },
      prior_art_candidates: priorArtCandidates,
      analysis_summary: evaluation.analysis_summary,
      generated_at: new Date().toISOString(),
      ...(exaResearchContext.length > 0 && { related_research: exaResearchContext }),
    };

    console.log(`[Prior Art Agent] Discovery completed for ${patent_id} in ${elapsed}ms (3 steps, ${priorArtCandidates.length} results)`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Prior Art Agent] Error:", error);

    // Return graceful error (200 with available=false) instead of 500
    // This prevents UI crashes and allows the panel to show a user-friendly error
    const errorMessage = (error as Error).message || "Unknown error";
    const isApiKeyError = errorMessage.includes("API") || errorMessage.includes("key") || errorMessage.includes("configured");
    const isRateLimitError = errorMessage.includes("rate") || errorMessage.includes("429") || errorMessage.includes("quota");

    let userFriendlyError = "Prior art discovery is temporarily unavailable. Please try again later.";
    if (isRateLimitError) {
      userFriendlyError = "Too many requests. Please wait a moment and try again.";
    } else if (isApiKeyError) {
      userFriendlyError = "Prior art search service is being configured. Please try again later.";
    }

    return new Response(
      JSON.stringify({
        patent_id,
        available: false,
        prior_art_candidates: [],
        key_concepts: [],
        search_strategy: { keywords: [], cpc_codes: [], date_range: {} },
        error: userFriendlyError,
        powered_by: "Gemini 3",
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handle AI Landscape Analysis - Competitive landscape overview for a technology domain
 * Multi-step orchestration: Extract assignees -> Cluster technologies -> Analyze trends -> Identify opportunities
 */
async function handleLandscape(body: LandscapeQuery): Promise<Response> {
  const { query, patents } = body;

  if (!query || typeof query !== "string") {
    return new Response(
      JSON.stringify({ error: "query is required and must be a string" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!patents || !Array.isArray(patents)) {
    return new Response(
      JSON.stringify({ error: "patents array is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (patents.length < 5) {
    return new Response(
      JSON.stringify({ error: "Minimum 5 patents required for landscape analysis" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (patents.length > 50) {
    return new Response(
      JSON.stringify({ error: "Maximum 50 patents allowed for landscape analysis" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  for (const p of patents) {
    if (!p.patent_id || !p.patent_title || !p.patent_abstract) {
      return new Response(
        JSON.stringify({ error: "Each patent requires patent_id, patent_title, and patent_abstract" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    return new Response(
      JSON.stringify({
        available: false,
        reason: "AI landscape analysis not configured. Set GEMINI_API_KEY in Supabase secrets.",
        powered_by: "Gemini 3",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[Landscape Analysis] Starting analysis for "${query}" with ${patents.length} patents`);
  const startTime = Date.now();

  try {
    // ========================================================================
    // STEP 0 (NEW): ENRICH - Fetch industry reports from Exa for grounding
    // ========================================================================
    console.log(`[Landscape Analysis] Step 0: Fetching industry context from Exa`);

    let industryContext: EnrichmentArticle[] = [];
    try {
      industryContext = await queryExaForEnrichment(
        `${query} industry report market analysis trends`,
        5
      );
      console.log(`[Landscape Analysis] Exa returned ${industryContext.length} industry articles`);
    } catch (exaError) {
      console.warn(`[Landscape Analysis] Exa enrichment failed, continuing without:`, exaError);
    }

    // ========================================================================
    // STEP 1: Process patent data for analysis
    // ========================================================================
    const patentSummaries = patents.map((p, i) =>
      `[${i + 1}] ${p.patent_id}: "${p.patent_title}" | Assignee: ${p.assignee || "Unknown"} | Filed: ${p.filing_date || "Unknown"}\nAbstract: ${p.patent_abstract.substring(0, 300)}...`
    ).join("\n\n");

    const assigneeCounts: Record<string, number> = {};
    for (const p of patents) {
      const assignee = p.assignee || "Unknown";
      assigneeCounts[assignee] = (assigneeCounts[assignee] || 0) + 1;
    }

    const filingYears: Record<string, number> = {};
    for (const p of patents) {
      if (p.filing_date) {
        const year = p.filing_date.substring(0, 4);
        filingYears[year] = (filingYears[year] || 0) + 1;
      }
    }

    const prompt = `You are a patent landscape analyst. Analyze this set of patents to provide a competitive landscape overview for the technology domain: "${query}"

PATENT DATA (${patents.length} patents):
${patentSummaries}

ASSIGNEE DISTRIBUTION:
${Object.entries(assigneeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => `- ${name}: ${count} patents`).join("\n")}

FILING YEARS DISTRIBUTION:
${Object.entries(filingYears).sort((a, b) => a[0].localeCompare(b[0])).map(([year, count]) => `- ${year}: ${count} patents`).join("\n")}

${industryContext.length > 0 ? `INDUSTRY CONTEXT (from Exa - for market insight):
${industryContext.map(a => `- "${a.title}" (${a.source || 'web'}): ${a.snippet.substring(0, 150)}`).join('\n')}

` : ''}IMPORTANT: Base your analysis ONLY on the patent data provided.
Use industry context for market insight but base all patent-specific findings on the provided data.

Analyze this patent set and return JSON ONLY (no markdown, no explanation):
{
  "market_overview": "2-3 sentence overview of the technology landscape based on the patent data",
  "top_assignees": [
    {
      "name": "Company Name",
      "patent_count": 5,
      "focus_areas": ["area1", "area2"],
      "trend": "growing|stable|declining"
    }
  ],
  "technology_clusters": [
    {
      "name": "Cluster Name",
      "description": "Brief description of this technology cluster",
      "key_patents": ["patent_id1", "patent_id2"],
      "maturity": "emerging|growing|mature|declining"
    }
  ],
  "filing_trends": {
    "overall_trend": "increasing|stable|decreasing",
    "peak_year": "2023",
    "insight": "Brief insight about filing trends"
  },
  "white_space_opportunities": ["opportunity1", "opportunity2", "opportunity3"],
  "key_takeaways": ["takeaway1", "takeaway2", "takeaway3"]
}

IMPORTANT:
- Include 3-5 top assignees based on the data
- Identify 3-5 technology clusters from the patent abstracts
- For key_patents in clusters, use actual patent_ids from the data
- Base trend analysis on the filing year distribution
- White space opportunities should identify gaps in the patent coverage`;

    const geminiResponse = await callGemini(prompt);
    const analysis = parseGeminiJSON<{
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
    }>(geminiResponse);

    const elapsed = Date.now() - startTime;
    console.log(`[Landscape Analysis] Completed for "${query}" in ${elapsed}ms`);

    const result: LandscapeResult = {
      powered_by: "Gemini 3",
      query,
      analysis_date: new Date().toISOString().split("T")[0],
      market_overview: analysis.market_overview,
      top_assignees: analysis.top_assignees,
      technology_clusters: analysis.technology_clusters,
      filing_trends: analysis.filing_trends,
      white_space_opportunities: analysis.white_space_opportunities,
      key_takeaways: analysis.key_takeaways,
      generated_at: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Landscape Analysis] Error:", error);
    return new Response(
      JSON.stringify({
        query,
        available: false,
        error: "Landscape analysis is temporarily unavailable. Please try again later.",
        market_overview: "",
        top_assignees: [],
        technology_clusters: [],
        filing_trends: { overall_trend: "stable", insight: "" },
        white_space_opportunities: [],
        key_takeaways: [],
        powered_by: "Gemini 3",
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// Firecrawl Patent Content Scraping - with 8-key round-robin rate limit bypass
// ============================================================================
async function handleFirecrawlScrape(data: FirecrawlScrapeQuery): Promise<Response> {
  const patentId = data.patent_id;
  const patentUrl = data.patent_url || `https://patents.google.com/patent/${patentId}/en`;

  console.log(`[Firecrawl] Scraping patent content for: ${patentId}`);
  console.log(`[Firecrawl] Available API keys: ${FIRECRAWL_KEYS.length}`);

  if (FIRECRAWL_KEYS.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        available: false,
        patent_id: patentId,
        error: "No Firecrawl API keys configured",
      } as FirecrawlResult),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Try each API key until one works (round-robin with 429 retry)
  let lastError = "";
  const maxAttempts = Math.min(FIRECRAWL_KEYS.length, 8);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const apiKey = getNextFirecrawlKey();
    if (!apiKey) break;

    const keyIndex = (firecrawlKeyIndex - 1 + FIRECRAWL_KEYS.length) % FIRECRAWL_KEYS.length;
    console.log(`[Firecrawl] Attempt ${attempt + 1}/${maxAttempts} using key #${keyIndex + 1}`);

    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: patentUrl,
          onlyMainContent: true,
          formats: ["markdown"],
        }),
      });

      if (response.status === 429) {
        // Rate limited - try next key
        console.log(`[Firecrawl] Key #${keyIndex + 1} rate limited (429), trying next...`);
        lastError = "Rate limit exceeded";
        continue;
      }

      if (response.status === 402) {
        // Payment required - skip this key
        console.log(`[Firecrawl] Key #${keyIndex + 1} credits exhausted (402), trying next...`);
        lastError = "API credits exhausted";
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Firecrawl] Error ${response.status}: ${errorText}`);
        lastError = `API error: ${response.status}`;
        continue;
      }

      const result = await response.json();

      if (!result.success) {
        console.error(`[Firecrawl] API returned success=false:`, result.error);
        lastError = result.error || "Unknown error";
        continue;
      }

      console.log(`[Firecrawl] Successfully fetched content (${result.data?.markdown?.length || 0} chars)`);

      return new Response(
        JSON.stringify({
          success: true,
          patent_id: patentId,
          markdown: result.data?.markdown || "",
          metadata: {
            title: result.data?.metadata?.title,
            description: result.data?.metadata?.description,
            sourceURL: result.data?.metadata?.sourceURL || patentUrl,
          },
          fetched_at: new Date().toISOString(),
        } as FirecrawlResult),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (error) {
      console.error(`[Firecrawl] Fetch error:`, error);
      lastError = (error as Error).message;
      continue;
    }
  }

  // All keys exhausted or failed
  console.error(`[Firecrawl] All API keys failed. Last error: ${lastError}`);
  return new Response(
    JSON.stringify({
      success: false,
      available: false,
      patent_id: patentId,
      error: `All Firecrawl API keys exhausted: ${lastError}`,
    } as FirecrawlResult),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req: Request) => {

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          status: "PatentSentry API v5.0 - Powered by Gemini 3",
          features: [
            "USPTO PatentsView integration",
            "Maintenance fee tracking",
            "Patent watchlist",
            "Portfolio management",
            "Bulk analysis",
            "Exa AI enrichment (company news, market context, product mentions)",
            "Citation analysis",
            "Assignee portfolio lookup",
            "🤖 Gemini 3 AI Patent Analysis (claims summary, technical scope, FTO considerations)",
            "🔗 Inventor Network Analysis (collaboration patterns, co-inventors, clusters)",
            "💰 AI Portfolio Valuation (strategic value scoring)",
            "⚠️ AI FTO Risk Analyzer (product infringement risk assessment)",
            "🔍 AI Prior Art Discovery (autonomous prior art search agent)",
            "🗺️ AI Landscape Analysis (competitive landscape overview)",
          ],
          endpoints: {
            search: { action: "search", query: "string" },
            analyze: { action: "analyze", patent_id: "string" },
            bulk_analyze: { action: "bulk_analyze", patent_ids: ["string"] },
            enrich: { action: "enrich", patent_id: "string", patent_title: "string?", assignee: "string?" },
            citations: { action: "citations", patent_id: "string" },
            assignee_patents: { action: "assignee_patents", assignee: "string", limit: "number?" },
            ai_analyze: { action: "ai_analyze", patent_id: "string", patent_title: "string", patent_abstract: "string", assignee: "string?", filing_date: "string?", expiration_date: "string?" },
            ai_claim_graph: { action: "ai_claim_graph", patent_id: "string", patent_title: "string", patent_abstract: "string", claims_text: "string?" },
            ai_portfolio_value: { action: "ai_portfolio_value", patents: "Array<{patent_id, patent_title, patent_abstract, ...}>" },
            inventor_network: { action: "inventor_network", inventor_name: "string?", assignee: "string?", patent_ids: "string[]?", limit: "number?" },
            ai_fto_analyze: { action: "ai_fto_analyze", product_description: "string", patents: "Array<{patent_id, patent_title, patent_abstract, claims_text?}>" },
            ai_prior_art: { action: "ai_prior_art", patent_id: "string", patent_title: "string", patent_abstract: "string", claims_text: "string?", filing_date: "string?" },
            ai_landscape: { action: "ai_landscape", query: "string", patents: "Array<{patent_id, patent_title, patent_abstract, assignee?, filing_date?}>" },
            watchlist: { action: "get_watchlist | add_to_watchlist | remove_from_watchlist | get_expiring_soon" },
            portfolio: { action: "list_portfolios | create_portfolio | add_to_portfolio | get_portfolio | analyze_portfolio" },
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();

    switch (body.action) {
      case "search":
        return handleSearch(body as SearchQuery);
      case "analyze":
        return handleAnalyze(body as AnalyzeQuery);
      case "bulk_analyze":
        return handleBulkAnalyze(body as BulkAnalyzeQuery);
      case "enrich":
        return handleEnrich(body as EnrichQuery);
      case "citations":
        return handleCitations(body as CitationsQuery);
      case "assignee_patents":
        return handleAssigneePatents(body as AssigneePatentsQuery);
      case "ai_analyze":
        return handleAIAnalyze(body as AIAnalyzeQuery);
      case "ai_compare":
        return handleAICompare(body as AICompareQuery);
      case "query_expand":
        return handleQueryExpand(body as QueryExpandQuery);
      case "ai_claim_graph":
        return handleClaimGraph(body as ClaimGraphQuery);
      case "ai_portfolio_value":
        return handlePortfolioValue(body as PortfolioValueQuery);
      case "inventor_network":
        return handleInventorNetwork(body as InventorNetworkQuery);
      case "ai_fto_analyze":
        return handleFTOAnalyze(body as FTOAnalyzeQuery);
      case "ai_prior_art":
        return handlePriorArt(body as PriorArtQuery);
      case "ai_landscape":
        return handleLandscape(body as LandscapeQuery);
      case "firecrawl_scrape":
        return handleFirecrawlScrape(body as FirecrawlScrapeQuery);
      case "get_watchlist":
      case "add_to_watchlist":
      case "remove_from_watchlist":
      case "get_expiring_soon":
        return handleWatchlist(body as WatchlistQuery, req);
      case "list_portfolios":
      case "create_portfolio":
      case "add_to_portfolio":
      case "get_portfolio":
      case "analyze_portfolio":
        return handlePortfolio(body as PortfolioQuery, req);
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${(body as Record<string, unknown>).action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
