# PatentSentry

🤖 **Powered by Gemini 3** - AI-enhanced patent research and expiration tracking that goes beyond Google Patents. Get exact expiration dates, AI-powered claims analysis, maintenance fee schedules, business context, and more.

**Built for the Gemini 3 Hackathon by [@asynchronope](https://github.com/bO-05) | [Twitter/X](https://x.com/asynchronope)**

## Why PatentSentry vs Google Patents?

| Feature | PatentSentry | Google Patents |
|---------|---------------|----------------|
| **AI Patent Analysis** | ✅ Gemini 3 multi-step pipeline | ❌ Not available |
| **Claim Dependency Graph** | ✅ Visual claim structure | ❌ Not available |
| **Prior Art Discovery** | ✅ AI autonomous agent | ❌ Manual search only |
| **FTO Risk Analyzer** | ✅ Product vs patents analysis | ❌ Not available |
| **Portfolio Valuation** | ✅ AI scoring & insights | ❌ Not available |
| **Inventor Networks** | ✅ Collaboration graph | ❌ Not available |
| **Patent Landscape** | ✅ Technology area analysis | ❌ Not available |
| Expiration Calculation | ✅ Exact (PTA/PTE/TD) | ❌ Estimates only |
| Maintenance Fee Schedule | ✅ 3.5/7.5/11.5 year windows | ❌ Not available |
| Business Context | ✅ Company news, market intel | ❌ Not available |
| Portfolio Management | ✅ Track & analyze groups | ❌ Not available |

## Features

### 🤖 AI-Powered Analysis (Gemini 3 - Multi-Step Pipeline)

**Core Analysis** (3-step Extract → Analyze → Synthesize):
- **Claims Summarization** - Plain-language explanation of what the patent protects
- **Technical Scope Assessment** - Understand the technology domain and coverage
- **Key Innovations** - Identify the novel aspects of the patent
- **FTO Considerations** - Freedom-to-operate risk indicators
- **Competitive Landscape** - AI-generated competitive context

**Advanced AI Features**:
- **Claim Dependency Graph** - Visual tree showing independent/dependent claim relationships
- **Prior Art Discovery Agent** - Autonomous multi-step agent that finds prior art candidates
- **FTO Risk Analyzer** - Analyze your product description against selected patents for infringement risk
- **AI Patent Comparison** - Compare 2-5 patents with overlap analysis and differentiation matrix
- **Portfolio Valuation** - AI scoring of patent portfolios with strategic insights
- **Patent Landscape Analysis** - Technology area overview with top assignees, clusters, and white spaces
- **AI Query Expansion** - Gemini expands searches with synonyms, related terms, and CPC codes

**Data Intelligence**:
- **Inventor Network Graph** - Visualize collaboration patterns between inventors

### 📊 Patent Intelligence
- **Smart Patent Search** - Search USPTO patents with intelligent query matching
- **Exact Expiration Dates** - Calculate with PTA/PTE adjustments and terminal disclaimers
- **Maintenance Fee Tracking** - View upcoming 3.5, 7.5, and 11.5 year fee deadlines
- **Business Context** *(Exa AI)* - Company news, market context, product mentions
- **Patent Watchlist** - Track patents and get expiration alerts
- **Portfolio Management** - Organize patents into portfolios with bulk analysis
- **Citation Analysis** - View forward and backward citations
- **Assignee Research** - Find other patents from the same assignee
- **Export Options** - Download analysis as JSON or CSV
- **User Authentication** - Supabase Auth with per-user data isolation
- **Keyboard Navigation** - Power-user shortcuts (`j/k`, `/`, `?`, `Enter`, `x`, `Ctrl+K`)

## Quick Start

### Local Development

```bash
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
npm run dev
```

### Deploy to Vercel

1. Set environment variables in Vercel dashboard:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

2. Configure Supabase Edge Function secrets:
   ```bash
   supabase secrets set PATENTSVIEW_API_KEY=your-key
   supabase secrets set EXA_API_KEY=your-key
   supabase secrets set GEMINI_API_KEY=your-key
   ```

3. Deploy:
   ```bash
   git push  # Automatic deployment via Vercel
   ```

## Tech Stack

- **AI**: Google Gemini 3 (patent analysis, claims summarization)
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: Supabase PostgreSQL
- **APIs**: USPTO PatentsView, Exa AI, Google Gemini API
- **Local Dev**: Optional FastAPI backend

## 🧠 Action Era Architecture

PatentSentry implements **multi-step AI orchestration** aligned with the Gemini 3 Hackathon's [Action Era criteria](https://gemini3.devpost.com/):

### 3-Step Analysis Pipeline

Unlike single-prompt wrappers, PatentSentry chains **3 separate Gemini API calls** for each patent analysis:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   STEP 1     │ ──▶ │   STEP 2     │ ──▶ │   STEP 3     │
│   Extract    │     │   Analyze    │     │  Synthesize  │
│              │     │              │     │              │
│ • Domain     │     │ • FTO Risk   │     │ • Summary    │
│ • Core claim │     │ • Threats    │     │ • Strategy   │
│ • Keywords   │     │ • Scope      │     │ • Confidence │
└──────────────┘     └──────────────┘     └──────────────┘
```

Each step builds on the previous output, demonstrating **chained reasoning** rather than simple prompt wrapping.

### Additional Gemini Features
- **AI Compare**: Multi-patent analysis with overlap detection
- **Query Expansion**: Search term enrichment via Gemini
- **Prefetch on Hover**: Background fetching for perceived speed

## Project Structure

```
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # API client and utilities
│   └── types/              # TypeScript definitions
├── supabase/
│   ├── functions/          # Edge Functions (production backend)
│   └── migrations/         # Database migrations
├── backend/                # Local FastAPI backend (development)
└── docs/                   # Documentation
```

## Documentation

| Document | Description |
|----------|-------------|
| [Setup Guide](docs/setup.md) | Environment configuration and API keys |
| [Supabase Setup](docs/supabase-setup.md) | Deploy your own Supabase project |
| [Local Backend](docs/local-backend.md) | FastAPI development server |
| [Performance](docs/performance.md) | Caching and optimization details |
| [Troubleshooting](docs/troubleshooting.md) | Common issues and solutions |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |

## API Keys

| Key | Source | Required |
|-----|--------|----------|
| PatentsView | [Request here](https://patentsview-support.atlassian.net/servicedesk/customer/portal/1) | Yes |
| Exa AI | [exa.ai](https://exa.ai/) | For enrichment |
| Gemini | [Google AI Studio](https://aistudio.google.com/) | For AI analysis |

## Security Notes

- Never commit `.env` files to git (use `.env.example` as template)
- Supabase Edge Function secrets are server-side only (safe from exposure)
- Frontend env vars prefixed with `VITE_` are public (use for non-sensitive data only)
- API keys for PatentsView and Exa should only exist in Supabase secrets, never in frontend code

## Contributing

Found a bug? Have a feature request? Open an issue on [GitHub](https://github.com/bO-05/PatentSentry).

## License

MIT

---

**Made by [asynchronope](https://github.com/bO-05)**
