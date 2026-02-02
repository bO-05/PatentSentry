# PatentSentry Development Guide

## Quick Commands

```bash
# Development
npm run dev           # Start Vite dev server
npm run build         # Production build
npm run typecheck     # TypeScript check
npm run lint          # ESLint

# Local backend (FastAPI)
cd backend && pip install -r requirements.txt && python ps.py
```

## Architecture

### Frontend (React/TypeScript/Vite)
- `src/App.tsx` - Main application component with routing
- `src/components/` - UI components
- `src/lib/api.ts` - API client with caching, timeouts, cancellation
- `src/lib/supabase.ts` - Supabase client
- `src/types/patent.ts` - TypeScript types

### Backend (Supabase Edge Functions - Production)
- `supabase/functions/patent-search/index.ts` - Unified API handler
- All actions routed through single POST endpoint

### Backend (FastAPI - Local Dev)
- `backend/ps.py` - Unified API matching Edge Function
- Supports Claude AI for query expansion

## API Keys

| Key | Service | Purpose |
|-----|---------|---------|
| `PATENTSVIEW_API_KEY` | USPTO PatentsView | Patent data (required) |
| `EXA_API_KEY` | Exa AI | Business context (optional) |
| `ANTHROPIC_API_KEY` | Claude | AI query expansion (optional, local only) |

## Key Features

### Caching Strategy
- Client-side: In-memory caches with TTL
- Server-side: PostgreSQL tables with expires_at
- Stale-while-revalidate pattern for perceived speed

### Performance
- Request cancellation via AbortController
- Configurable timeouts (15s search, 20s analyze, 10s enrich)
- Prefetching on hover/focus

## Code Conventions

- Use Tailwind CSS for styling
- TypeScript with strict mode (some legacy loose typing)
- Functional React components with hooks
- API responses use Record<string, unknown> for flexibility

## Database Tables

- `search_history` - Search queries
- `bookmarks` - User bookmarks
- `watched_patents` - Watchlist with alerts
- `portfolio_groups` - Patent portfolios
- `portfolio_patents` - Portfolio membership
- `patent_analysis_cache` - Cached analysis
- `patent_enrichments` - Cached Exa AI data
