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
  const userClient = getUserClient(req);
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
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

type RequestBody = SearchQuery | AnalyzeQuery | BulkAnalyzeQuery | WatchlistQuery | PortfolioQuery | EnrichQuery | CitationsQuery | AssigneePatentsQuery;

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

  const requestBody: Record<string, unknown> = {
    q: { "_text_any": { "patent_title": query } },
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          status: "PatentSentry API v4.0",
          features: [
            "USPTO PatentsView integration",
            "Maintenance fee tracking",
            "Patent watchlist",
            "Portfolio management",
            "Bulk analysis",
            "Exa AI enrichment (company news, market context, product mentions)",
            "Citation analysis",
            "Assignee portfolio lookup",
          ],
          endpoints: {
            search: { action: "search", query: "string" },
            analyze: { action: "analyze", patent_id: "string" },
            bulk_analyze: { action: "bulk_analyze", patent_ids: ["string"] },
            enrich: { action: "enrich", patent_id: "string", patent_title: "string?", assignee: "string?" },
            citations: { action: "citations", patent_id: "string" },
            assignee_patents: { action: "assignee_patents", assignee: "string", limit: "number?" },
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
