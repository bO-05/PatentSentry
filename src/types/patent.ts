export interface Assignee {
  assignee_organization: string;
  assignee_type: string;
}

export interface Inventor {
  inventor_name_first?: string;
  inventor_name_last?: string;
  inventor_first_name?: string;
  inventor_last_name?: string;
}

export interface PatentSearchResult {
  patent_id: string;
  patent_title: string;
  patent_date: string;
  patent_abstract: string;
  patent_type?: string;
  assignees?: Assignee[];
  inventors?: Inventor[];
  us_related_documents?: Array<{
    related_doc_number: string;
    related_doc_type: string;
  }>;
  url?: string;
  score?: number;
  source?: string;
}

export interface PatentAnalysis {
  patent_id: string;
  title: string;
  abstract: string;
  dates: {
    filed: string;
    granted: string;
    baseline_expiry: string;
    calculated_expiry: string;
    pta_days: number;
    pte_days: number;
    is_filing_estimated: boolean;
  };
  warnings: {
    terminal_disclaimer: boolean;
    td_date: string | null;
    fee_status: string;
    reason: string;
  };
  is_active: boolean;
  url?: string;
  source?: string;
}

export interface SearchResponse {
  query: string;
  results: PatentSearchResult[];
  total_count: number;
  page: number;
  per_page: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  error?: string;
  note?: string;
  source?: string;
  setup_url?: string;
}
