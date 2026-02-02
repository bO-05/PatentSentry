"""
PatentSentry Local Backend (FastAPI)

Mirrors the Supabase Edge Function API for local development.
Provides unified endpoint at POST /patent-search with action-based routing.

Features:
- Patent search via PatentsView API
- Patent analysis with expiration calculation
- AI-powered query expansion (Anthropic)
- Exa AI enrichment (company news, market context, product mentions)
"""

import os
import json
import hashlib
import calendar
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from functools import lru_cache
from dateutil.relativedelta import relativedelta

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from anthropic import Anthropic
from starlette.concurrency import run_in_threadpool
from contextlib import asynccontextmanager
import dotenv

dotenv.load_dotenv()

http_client: Optional[httpx.AsyncClient] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient(timeout=30.0)
    yield
    await http_client.aclose()

app = FastAPI(title="PatentSentry API", version="4.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API clients (lazy initialization)
_claude_client = None
_exa_client = None

def get_claude_client():
    global _claude_client
    if _claude_client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if api_key:
            _claude_client = Anthropic(api_key=api_key)
    return _claude_client

def get_exa_client():
    global _exa_client
    if _exa_client is None:
        api_key = os.environ.get("EXA_API_KEY")
        if api_key:
            try:
                from exa_py import Exa
                _exa_client = Exa(api_key=api_key)
            except ImportError:
                pass
    return _exa_client

# In-memory caches with TTL
_enrichment_cache: Dict[str, Dict[str, Any]] = {}
_analysis_cache: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 3600 * 24  # 24 hours

# =============================================================================
# Request Models
# =============================================================================

class UnifiedRequest(BaseModel):
    action: str
    # Search fields
    query: Optional[str] = None
    page: Optional[int] = 1
    per_page: Optional[int] = 25
    sort: Optional[str] = "relevance"
    # Analyze fields
    patent_id: Optional[str] = None
    patent_ids: Optional[List[str]] = None
    force_refresh: Optional[bool] = False
    # Enrich fields
    patent_title: Optional[str] = None
    assignee: Optional[str] = None
    # Assignee patents
    limit: Optional[int] = 10

# =============================================================================
# Utility Functions
# =============================================================================

STOPWORDS = {
    'a', 'an', 'the', 'and', 'or', 'but', 'for', 'of', 'to', 'in', 'on', 'at',
    'by', 'with', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those',
    'method', 'system', 'apparatus', 'device', 'thereof', 'therefor', 'therein',
    'comprising', 'including', 'having', 'using', 'making', 'forming',
}

def extract_key_terms(title: str) -> List[str]:
    """Extract meaningful terms from patent title."""
    import re
    terms = re.sub(r'[^a-z0-9\s]', ' ', title.lower()).split()
    unique_terms = []
    seen = set()
    for term in terms:
        if len(term) > 2 and term not in STOPWORDS and term not in seen:
            unique_terms.append(term)
            seen.add(term)
            if len(unique_terms) >= 6:
                break
    return unique_terms

def calculate_expiry(filing_str: str, pta_days: int = 0, pte_days: int = 0, td_date_str: Optional[str] = None):
    """Calculate patent expiration date with adjustments."""
    fmt = "%Y-%m-%d"
    filing_date = datetime.strptime(filing_str, fmt)
    
    # Add exactly 20 calendar years from filing date, preserving month/day
    # and handling end-of-month edge cases (e.g., Feb 29 -> Feb 28 on non-leap years)
    baseline = filing_date + relativedelta(years=20)
    
    total_adjustment = int(pta_days or 0) + int(pte_days or 0)
    adjusted_date = baseline + timedelta(days=total_adjustment)
    
    reason = "20 years from filing"
    if pta_days:
        reason += f" + {pta_days} days PTA"
    if pte_days:
        reason += f" + {pte_days} days PTE"
    
    final_date = adjusted_date
    
    if td_date_str:
        td_date = datetime.strptime(td_date_str, fmt)
        if td_date < adjusted_date:
            final_date = td_date
            reason = "Terminal Disclaimer (expires with linked patent)"
    
    return {
        "expiry": final_date.strftime(fmt),
        "reason": reason,
        "is_active": datetime.now() < final_date,
        "baseline_expiry": baseline.strftime(fmt),
        "pta_days": pta_days or 0,
        "pte_days": pte_days or 0,
        "calculated_expiry": final_date.strftime(fmt)
    }

def is_leap_year(year: int) -> bool:
    """Check if a year is a leap year."""
    return (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)

def calculate_design_patent_expiry(grant_date_str: str, filing_date_str: str) -> Dict:
    """Calculate expiration for design patents.
    
    Design patents filed before 2015-05-13: 14 years from grant date
    Design patents filed on/after 2015-05-13: 15 years from grant date
    """
    fmt = "%Y-%m-%d"
    grant_date = datetime.strptime(grant_date_str, fmt)
    filing_date = datetime.strptime(filing_date_str, fmt)
    
    cutoff_date = datetime.strptime("2015-05-13", fmt)
    years_to_add = 15 if filing_date >= cutoff_date else 14
    
    # Add years to grant date, handling leap year edge case (Feb 29)
    baseline = grant_date + relativedelta(years=years_to_add)
    
    reason = f"{years_to_add} years from grant date"
    
    return {
        "expiry": baseline.strftime(fmt),
        "reason": reason,
        "is_active": datetime.now() < baseline,
        "baseline_expiry": baseline.strftime(fmt),
        "pta_days": 0,
        "pte_days": 0,
        "calculated_expiry": baseline.strftime(fmt)
    }

def calculate_maintenance_fees(grant_date_str: str) -> Dict:
    """Calculate maintenance fee schedule from grant date."""
    grant_date = datetime.strptime(grant_date_str, "%Y-%m-%d")
    
    def add_years_months(date: datetime, years: int, months: int = 0) -> datetime:
        new_month = date.month + months
        new_year = date.year + years + (new_month - 1) // 12
        new_month = ((new_month - 1) % 12) + 1
        last_day_of_month = calendar.monthrange(new_year, new_month)[1]
        clamped_day = min(date.day, last_day_of_month)
        return date.replace(year=new_year, month=new_month, day=clamped_day)
    
    year_3_5 = add_years_months(grant_date, 3, 6)
    year_7_5 = add_years_months(grant_date, 7, 6)
    year_11_5 = add_years_months(grant_date, 11, 6)
    
    def fee_schedule(due_date: datetime) -> Dict:
        return {
            "due_date": due_date.strftime("%Y-%m-%d"),
            "window_start": add_years_months(due_date, 0, -6).strftime("%Y-%m-%d"),
            "window_end": due_date.strftime("%Y-%m-%d"),
            "surcharge_end": add_years_months(due_date, 0, 6).strftime("%Y-%m-%d"),
        }
    
    return {
        "year_3_5": fee_schedule(year_3_5),
        "year_7_5": fee_schedule(year_7_5),
        "year_11_5": fee_schedule(year_11_5),
    }

def get_patentsview_headers() -> Dict:
    """Get headers for PatentsView API calls."""
    api_key = os.environ.get("PATENTSVIEW_API_KEY", "")
    return {
        "X-Api-Key": api_key,
        "Content-Type": "application/json"
    }

# =============================================================================
# Action Handlers
# =============================================================================

async def handle_search(req: UnifiedRequest) -> Dict:
    """Search patents via PatentsView API with optional AI query expansion."""
    query = req.query
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query parameter is required")
    
    # Optional: AI-powered query expansion
    claude = get_claude_client()
    keywords = [query]
    
    if claude:
        try:
            response = await run_in_threadpool(
                lambda: claude.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=256,
                    system="You are a patent search expert. Convert the user's input into 3-5 synonymous keywords/phrases for patent search. Return ONLY a JSON array of strings.",
                    messages=[{"role": "user", "content": query}]
                )
            )
            parsed_keywords = json.loads(response.content[0].text)
            if isinstance(parsed_keywords, list) and len(parsed_keywords) > 0:
                keywords = parsed_keywords
            print(f"[search] AI keywords: {keywords}")
        except Exception as e:
            print(f"[search] AI expansion failed: {e}")
    
    # Build PatentsView query
    url = "https://search.patentsview.org/api/v1/patent/"
    
    if len(keywords) > 1:
        q = {"_or": [{"_text_any": {"patent_title": kw}} for kw in keywords]}
    else:
        q = {"_text_any": {"patent_title": keywords[0]}}
    
    page = req.page or 1
    per_page = req.per_page or 25
    offset = (page - 1) * per_page
    
    body = {
        "q": q,
        "f": [
            "patent_id", "patent_title", "patent_abstract", "patent_date",
            "patent_type", "patent_earliest_application_date", "assignees", "inventors"
        ],
        "o": {"size": per_page, "from": offset}
    }
    
    # Add sorting
    if req.sort == "date_desc":
        body["s"] = [{"patent_date": "desc"}]
    elif req.sort == "date_asc":
        body["s"] = [{"patent_date": "asc"}]
    
    try:
        r = await http_client.post(url, headers=get_patentsview_headers(), json=body)
        r.raise_for_status()
        data = r.json()
        
        patents = []
        for p in data.get("patents", []):
            filing_date = p.get("patent_earliest_application_date")
            grant_date = p.get("patent_date")
            
            expiration_info = None
            if filing_date and grant_date and p.get("patent_type") != "design":
                expiration_info = calculate_expiry(filing_date, 0, 0, None)
            
            patents.append({
                "patent_id": f"US{p['patent_id']}",
                "patent_number": p["patent_id"],
                "patent_title": p.get("patent_title"),
                "patent_abstract": p.get("patent_abstract"),
                "patent_date": grant_date,
                "filing_date": filing_date,
                "patent_type": p.get("patent_type"),
                "expiration_date": expiration_info["expiry"] if expiration_info else None,
                "is_active": expiration_info["is_active"] if expiration_info else None,
                "assignees": p.get("assignees", []),
                "inventors": p.get("inventors", []),
                "source": "patentsview",
                "url": f"https://patents.google.com/patent/US{p['patent_id']}",
            })
        
        total = data.get("total_hits", data.get("count", 0))
        total_pages = max(1, (total + per_page - 1) // per_page)
        
        return {
            "query": query,
            "keywords": keywords if len(keywords) > 1 else None,
            "results": patents,
            "total_count": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
            "source": "patentsview",
        }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"PatentsView API error: {str(e)}")

async def handle_analyze(req: UnifiedRequest) -> Dict:
    """Analyze a single patent for expiration and maintenance fees."""
    patent_id = req.patent_id
    if not patent_id:
        raise HTTPException(status_code=400, detail="patent_id required")
    
    # Parse patent number
    patent_num = patent_id.upper().replace("US", "").strip()
    
    # Check cache
    cache_key = f"analyze:{patent_num}"
    if not req.force_refresh and cache_key in _analysis_cache:
        cached = _analysis_cache[cache_key]
        if datetime.now().timestamp() - cached["timestamp"] < CACHE_TTL_SECONDS:
            return {**cached["data"], "from_cache": True}
    
    url = "https://search.patentsview.org/api/v1/patent/"
    body = {
        "q": {"patent_id": patent_num},
        "f": [
            "patent_id", "patent_title", "patent_abstract", "patent_date",
            "patent_earliest_application_date", "patent_term_extension",
            "patent_type", "assignees", "inventors", "cpc_current"
        ],
        "o": {"size": 1}
    }
    
    try:
        r = await http_client.post(url, headers=get_patentsview_headers(), json=body)
        r.raise_for_status()
        data = r.json()
        
        if not data.get("patents"):
            raise HTTPException(status_code=404, detail="Patent not found")
        
        p = data["patents"][0]
        filing_date = p.get("patent_earliest_application_date")
        grant_date = p.get("patent_date")
        pte_days = p.get("patent_term_extension") or 0
        patent_type = p.get("patent_type", "").lower()
        
        if not filing_date:
            raise HTTPException(status_code=400, detail="Filing date not available")
        
        # Check if this is a design patent
        is_design = "design" in patent_type if patent_type else False
        
        if is_design:
            # Design patents use different expiry rules
            if not grant_date:
                raise HTTPException(status_code=400, detail="Grant date required for design patent expiry calculation")
            expiration = calculate_design_patent_expiry(grant_date, filing_date)
            maintenance_fees = None  # Design patents don't have maintenance fees
        else:
            # Utility/plant patents use standard 20-year rule with PTA/PTE
            expiration = calculate_expiry(filing_date, 0, pte_days, None)
            maintenance_fees = calculate_maintenance_fees(grant_date) if grant_date else None
        
        result = {
            "patent_id": f"US{p['patent_id']}",
            "title": p.get("patent_title"),
            "abstract": p.get("patent_abstract"),
            "patent_type": p.get("patent_type"),
            "dates": {
                "filed": filing_date,
                "granted": grant_date,
                "baseline_expiry": expiration["baseline_expiry"],
                "calculated_expiry": expiration["calculated_expiry"],
                "pta_days": expiration["pta_days"],
                "pte_days": expiration["pte_days"],
            },
            "expiration": expiration,
            "maintenance_fees": maintenance_fees,
            "warnings": {
                "terminal_disclaimer": False,
                "fee_status": "Cannot verify if fees have been paid. Check USPTO PAIR." if not is_design else "Design patents do not require maintenance fees.",
                "reason": expiration["reason"],
            },
            "is_active": expiration["is_active"],
            "assignees": p.get("assignees", []),
            "inventors": p.get("inventors", []),
            "cpc_codes": p.get("cpc_current", []),
            "source": "patentsview",
            "url": f"https://patents.google.com/patent/US{p['patent_id']}",
        }
        
        # Cache the result
        _analysis_cache[cache_key] = {"data": result, "timestamp": datetime.now().timestamp()}
        
        return result
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

async def handle_enrich(req: UnifiedRequest) -> Dict:
    """Fetch enrichment data via Exa AI (company news, market context, product mentions)."""
    patent_id = req.patent_id
    if not patent_id:
        raise HTTPException(status_code=400, detail="patent_id required")
    
    exa = get_exa_client()
    if not exa:
        return {
            "patent_id": patent_id,
            "available": False,
            "reason": "Enrichment service not configured (EXA_API_KEY missing)",
            "company_news": [],
            "market_context": [],
            "product_mentions": [],
        }
    
    assignee = req.assignee
    if not assignee:
        return {
            "patent_id": patent_id,
            "available": False,
            "reason": "Assignee information required for enrichment",
            "company_news": [],
            "market_context": [],
            "product_mentions": [],
        }
    
    # Check cache
    cache_key = f"enrich:{patent_id}"
    if not req.force_refresh and cache_key in _enrichment_cache:
        cached = _enrichment_cache[cache_key]
        if datetime.now().timestamp() - cached["timestamp"] < CACHE_TTL_SECONDS:
            return {**cached["data"], "from_cache": True}
    
    print(f"[enrich] Fetching for {patent_id}, assignee: {assignee}")
    
    key_terms = extract_key_terms(req.patent_title) if req.patent_title else []
    tech_context = " ".join(key_terms[:4])
    
    # Calculate date 2 years ago
    start_date = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%d")
    
    async def query_exa(query: str) -> List[Dict]:
        try:
            results = await run_in_threadpool(
                lambda: exa.search(
                    query=query,
                    num_results=5,
                    start_published_date=start_date,
                    use_autoprompt=False,
                )
            )
            return [
                {
                    "title": r.title or "",
                    "url": r.url or "",
                    "snippet": (r.text or "")[:300],
                    "date": r.published_date,
                    "source": r.url.split("/")[2].replace("www.", "") if r.url else "",
                }
                for r in results.results
            ]
        except Exception as e:
            print(f"[enrich] Exa query error: {e}")
            return []
    
    # Run queries
    company_news = await query_exa(
        f'"{assignee}" (funding OR partnership OR acquisition OR lawsuit OR patent OR regulation)'
    )
    market_context = await query_exa(
        f"{tech_context} market analysis industry report adoption competitors"
    )
    product_mentions = await query_exa(
        f'"{assignee}" {" ".join(key_terms[:2])} (product OR launch OR "powered by" OR announces)'
    )
    
    result = {
        "patent_id": patent_id,
        "available": True,
        "assignee": assignee,
        "company_news": company_news,
        "market_context": market_context,
        "product_mentions": product_mentions,
    }
    
    # Cache
    _enrichment_cache[cache_key] = {"data": result, "timestamp": datetime.now().timestamp()}
    
    return result

async def handle_citations(req: UnifiedRequest) -> Dict:
    """Get citation data for a patent using the PatentsView citation endpoint."""
    patent_id = req.patent_id
    if not patent_id:
        raise HTTPException(status_code=400, detail="patent_id required")
    
    patent_num = patent_id.upper().replace("US", "").strip()
    
    citation_url = "https://search.patentsview.org/api/v1/patent/us_patent_citation/"
    
    try:
        patent_url = "https://search.patentsview.org/api/v1/patent/"
        
        # Get patents that cite this one (forward citations)
        # Query where citation_patent_id = our patent (meaning other patents cite us)
        r = await http_client.post(citation_url, headers=get_patentsview_headers(), json={
            "q": {"citation_patent_id": patent_num},
            "f": ["patent_id", "citation_patent_id", "citation_date", "citation_category"],
            "o": {"size": 20}
        })
        r.raise_for_status()
        
        data = r.json()
        cited_by_raw = data.get("us_patent_citations", [])
        
        # Get patents that this patent cites (backward citations)
        # Query where patent_id = our patent (meaning we cite other patents)
        r2 = await http_client.post(citation_url, headers=get_patentsview_headers(), json={
            "q": {"patent_id": patent_num},
            "f": ["patent_id", "citation_patent_id", "citation_date", "citation_category"],
            "o": {"size": 20}
        })
        r2.raise_for_status()
        
        data2 = r2.json()
        cites_raw = data2.get("us_patent_citations", [])
        
        # Extract unique patent IDs that need details fetched
        cited_by_ids = [c.get("patent_id", "").upper() for c in cited_by_raw]
        cites_ids = [c.get("citation_patent_id", "").upper() for c in cites_raw]
        all_patent_ids = list(set([id for id in cited_by_ids + cites_ids if id]))
        
        # Fetch patent details (title, date, assignee) for all cited patents
        patent_details_map = {}
        if all_patent_ids:
            r_details = await http_client.post(patent_url, headers=get_patentsview_headers(), json={
                "q": {"patent_id": {"_in": all_patent_ids}},
                "f": ["patent_id", "patent_title", "patent_date", "assignees"],
                "o": {"size": len(all_patent_ids)}
            })
            if r_details.is_success:
                details_data = r_details.json()
                for p in details_data.get("patents", []):
                    patent_id_upper = str(p.get("patent_id", "")).upper()
                    assignees = p.get("assignees", [])
                    assignee_org = assignees[0].get("assignee_organization") if assignees else None
                    patent_details_map[patent_id_upper] = {
                        "patent_title": p.get("patent_title", "Unknown"),
                        "patent_date": p.get("patent_date", ""),
                        "assignee": assignee_org,
                    }
        
        # Build response with complete patent data
        cited_by = []
        for c in cited_by_raw:
            patent_id_upper = str(c.get("patent_id", "")).upper()
            details = patent_details_map.get(patent_id_upper, {"patent_title": "Unknown", "patent_date": ""})
            cited_by.append({
                "patent_id": f"US{c.get('patent_id', '')}",
                "patent_title": details["patent_title"],
                "patent_date": details["patent_date"],
                "assignee": details.get("assignee"),
            })
        
        cites = []
        for c in cites_raw:
            patent_id_upper = str(c.get("citation_patent_id", "")).upper()
            details = patent_details_map.get(patent_id_upper, {"patent_title": "Unknown", "patent_date": ""})
            cites.append({
                "patent_id": f"US{c.get('citation_patent_id', '')}",
                "patent_title": details["patent_title"],
                "patent_date": details["patent_date"],
                "assignee": details.get("assignee"),
            })
        
        return {
            "patent_id": patent_id,
            "cited_by": cited_by,
            "cited_by_count": len(cited_by),
            "cites": cites,
            "cites_count": len(cites),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Citations fetch error: {str(e)}")

async def handle_assignee_patents(req: UnifiedRequest) -> Dict:
    """Find other patents from the same assignee."""
    assignee = req.assignee
    if not assignee:
        raise HTTPException(status_code=400, detail="assignee required")
    
    url = "https://search.patentsview.org/api/v1/patent/"
    limit = req.limit or 10
    
    try:
        r = await http_client.post(url, headers=get_patentsview_headers(), json={
            "q": {"_text_any": {"assignees.assignee_organization": assignee}},
            "f": ["patent_id", "patent_title", "patent_date", "cpc_current"],
            "o": {"size": limit + 1},
            "s": [{"patent_date": "desc"}]
        })
        r.raise_for_status()
        data = r.json()
        
        exclude_id = req.patent_id.upper().replace("US", "") if req.patent_id else None
        patents = []
        
        for p in data.get("patents", []):
            if exclude_id and p["patent_id"] == exclude_id:
                continue
            if len(patents) >= limit:
                break
            patents.append({
                "patent_id": f"US{p['patent_id']}",
                "patent_title": p.get("patent_title"),
                "patent_date": p.get("patent_date"),
                "cpc_codes": [c.get("cpc_group_id") for c in (p.get("cpc_current") or [])[:3]],
            })
        
        return {
            "assignee": assignee,
            "patents": patents,
            "count": len(patents),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assignee patents fetch error: {str(e)}")

# =============================================================================
# Main Router
# =============================================================================

@app.get("/")
async def root():
    return {
        "status": "PatentSentry Local API v4.0",
        "features": [
            "USPTO PatentsView integration",
            "AI-powered query expansion (Anthropic)",
            "Exa AI enrichment (company news, market context, product mentions)",
            "Maintenance fee tracking",
        ],
        "endpoints": {
            "POST /patent-search": "Unified API endpoint with action-based routing",
        },
        "api_status": {
            "patentsview": bool(os.environ.get("PATENTSVIEW_API_KEY")),
            "anthropic": bool(os.environ.get("ANTHROPIC_API_KEY")),
            "exa": bool(os.environ.get("EXA_API_KEY")),
        }
    }

@app.post("/patent-search")
async def patent_search(req: UnifiedRequest):
    """Unified API endpoint - mirrors Supabase Edge Function."""
    action = req.action
    
    if action == "search":
        return await handle_search(req)
    elif action == "analyze":
        return await handle_analyze(req)
    elif action == "enrich":
        return await handle_enrich(req)
    elif action == "citations":
        return await handle_citations(req)
    elif action == "assignee_patents":
        return await handle_assignee_patents(req)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")

# Legacy endpoints for backward compatibility
@app.post("/search")
async def search_patents_legacy(query: str):
    """Legacy search endpoint."""
    return await handle_search(UnifiedRequest(action="search", query=query))

@app.post("/analyze")
async def analyze_patent_legacy(patent_id: str):
    """Legacy analyze endpoint."""
    return await handle_analyze(UnifiedRequest(action="analyze", patent_id=patent_id))

if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
