# PatentSentry

A patent research and expiration tracking tool that goes beyond Google Patents. Get exact expiration dates, maintenance fee schedules, business context, and more.

**Built by [@asynchronope](https://github.com/bO-05) | [Twitter/X](https://x.com/asynchronope)**

## Why PatentSentry vs Google Patents?

| Feature | PatentSentry | Google Patents |
|---------|---------------|----------------|
| Expiration Calculation | ✅ Exact (PTA/PTE/TD) | ❌ Estimates only |
| Maintenance Fee Schedule | ✅ 3.5/7.5/11.5 year windows | ❌ Not available |
| Business Context | ✅ Company news, market intel | ❌ Not available |
| Portfolio Management | ✅ Track & analyze groups | ❌ Not available |
| Expiration Alerts | ✅ Watchlist with notifications | ❌ Not available |
| Bulk Analysis | ✅ Analyze multiple patents | ❌ Not available |

## Features

- **Smart Patent Search** - Search USPTO patents with AI-powered query expansion
- **Exact Expiration Dates** - Calculate with PTA/PTE adjustments and terminal disclaimers
- **Maintenance Fee Tracking** - View upcoming 3.5, 7.5, and 11.5 year fee deadlines
- **Business Context** *(Exa AI)* - Company news, market context, product mentions
- **Patent Watchlist** - Track patents and get expiration alerts
- **Portfolio Management** - Organize patents into portfolios with bulk analysis
- **Citation Analysis** - View forward and backward citations
- **Assignee Research** - Find other patents from the same assignee
- **Export Options** - Download analysis as JSON or CSV
- **User Authentication** - Supabase Auth with per-user data isolation
- **Keyboard Navigation** - Power-user shortcuts (`j/k`, `/`, `?`, `Enter`, `x`)

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
   ```

3. Deploy:
   ```bash
   git push  # Automatic deployment via Vercel
   ```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: Supabase PostgreSQL
- **APIs**: USPTO PatentsView, Exa AI
- **Local Dev**: Optional FastAPI backend with Claude AI

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
| Anthropic | [console.anthropic.com](https://console.anthropic.com/) | Local dev only |

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
