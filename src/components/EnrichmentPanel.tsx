import { useState } from 'react';
import { Building2, TrendingUp, Package, ExternalLink, RefreshCw, AlertCircle, Newspaper, Globe } from 'lucide-react';
import { getPatentEnrichment, EnrichmentResult, EnrichmentArticle } from '../lib/api';

interface EnrichmentPanelProps {
  patentId: string;
  patentTitle?: string;
  assignee?: string;
}

function cleanDisplaySnippet(snippet: string): string {
  if (!snippet) return '';

  return snippet
    // Clean any remaining markdown/navigation that slipped through
    .replace(/\[{1,2}[^\]]*\]{1,2}/g, '')
    .replace(/\*+/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function ArticleCard({ article }: { article: EnrichmentArticle }) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  };

  const displaySnippet = cleanDisplaySnippet(article.snippet);
  const displayTitle = article.title?.replace(/[|–—]\s*[^|–—]+$/, '').trim() || 'Untitled';

  const isSafeUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Skip articles with no meaningful content or unsafe URLs
  if (!displayTitle || displayTitle.length < 5) return null;
  if (!article.url || !isSafeUrl(article.url)) return null;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1 group-hover:text-blue-700">
        {displayTitle}
      </h4>
      {displaySnippet && displaySnippet.length > 20 && (
        <p className="text-xs text-gray-600 line-clamp-3 mb-2 leading-relaxed">{displaySnippet}</p>
      )}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="truncate max-w-[140px] font-medium">{article.source || 'Source'}</span>
        <div className="flex items-center gap-1.5">
          {formatDate(article.date) && (
            <span className="text-gray-400">{formatDate(article.date)}</span>
          )}
          <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-blue-500" />
        </div>
      </div>
    </a>
  );
}

function ArticleSection({
  title,
  icon: Icon,
  articles,
  emptyMessage,
  color,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  articles: EnrichmentArticle[];
  emptyMessage: string;
  color: string;
}) {
  if (articles.length === 0) {
    return (
      <div className="space-y-2">
        <div className={`flex items-center gap-2 ${color}`}>
          <Icon className="w-4 h-4" />
          <h4 className="text-sm font-semibold">{title}</h4>
        </div>
        <p className="text-xs text-gray-500 italic">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 ${color}`}>
        <Icon className="w-4 h-4" />
        <h4 className="text-sm font-semibold">{title}</h4>
        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
          {articles.length}
        </span>
      </div>
      <div className="space-y-2">
        {articles.map((article, idx) => (
          <ArticleCard key={`${article.url}-${idx}`} article={article} />
        ))}
      </div>
    </div>
  );
}

export default function EnrichmentPanel({ patentId, patentTitle, assignee }: EnrichmentPanelProps) {
  const [enrichment, setEnrichment] = useState<EnrichmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const loadEnrichment = async (forceRefresh: boolean = false) => {
    setHasStarted(true);
    if (!assignee) {
      setError('Assignee information required for business context');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getPatentEnrichment(
        patentId,
        patentTitle,
        assignee,
        forceRefresh,
        (freshData) => {
          setEnrichment(freshData as EnrichmentResult);
        }
      );
      setEnrichment(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to load business context');
    } finally {
      setLoading(false);
    }
  };

  // Ready state - user must click to fetch
  if (!hasStarted) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Business Context</h3>
              <p className="text-sm text-gray-500">Company news & market intel</p>
            </div>
          </div>
        </div>
        <div className="p-6 text-center">
          <Globe className="w-12 h-12 text-orange-300 mx-auto mb-3" />
          <p className="text-gray-600 text-sm mb-4 max-w-sm mx-auto">
            Get real-time company news, market context, and product mentions.
          </p>
          <button
            onClick={() => loadEnrichment()}
            className="px-5 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm"
          >
            Load Business Context
          </button>
        </div>
      </div>
    );
  }

  // Show informative message if no assignee - don't silently hide
  if (!assignee) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Newspaper className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Business Context</h3>
            <p className="text-sm text-gray-500">Powered by Exa AI</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 bg-gray-100 rounded-lg">
          <Building2 className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-gray-600 font-medium">No company information available</p>
            <p className="text-xs text-gray-500 mt-1">
              This patent doesn't have an assignee (company) in its records. Business context search requires a company name to find relevant news and market information.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state (only show if no cached data)
  if (loading && !enrichment) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Newspaper className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Business Context</h3>
            <p className="text-sm text-gray-500">Powered by Exa AI</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 text-blue-500 animate-spin mr-2" />
          <span className="text-sm text-gray-600">Loading business context...</span>
        </div>
      </div>
    );
  }

  // Error state - Enhanced with actionable CTAs
  if (error && !enrichment) {
    const isRateLimit = error.toLowerCase().includes('too many') || error.toLowerCase().includes('rate limit');
    const isAuthError = error.toLowerCase().includes('sign in');

    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Newspaper className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Business Context</h3>
            <p className="text-sm text-gray-500">Powered by Exa AI</p>
          </div>
        </div>
        <div className="flex items-start gap-2 text-amber-700 bg-amber-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-sm">{error}</span>

            {/* Rate limit hint */}
            {isRateLimit && (
              <p className="text-xs text-amber-600 mt-1">
                Please wait a moment before trying again.
              </p>
            )}

            {/* Auth hint */}
            {isAuthError && (
              <p className="text-xs text-amber-600 mt-1">
                Click <strong>Sign In</strong> in the top right to access this feature.
              </p>
            )}

            {/* Retry button for non-auth errors */}
            {!isAuthError && (
              <button
                onClick={() => loadEnrichment(true)}
                className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 mt-2 font-medium"
              >
                <RefreshCw className="w-3 h-3" />
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Not available
  if (enrichment && !enrichment.available) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Newspaper className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Business Context</h3>
            <p className="text-sm text-gray-500">{enrichment.reason || 'Not available'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!enrichment) {
    // Fallback state - shouldn't normally reach here, but provide user feedback
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Newspaper className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Business Context</h3>
            <p className="text-sm text-gray-500">Powered by Exa AI</p>
          </div>
        </div>
        <button
          onClick={() => loadEnrichment(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Load Business Context
        </button>
      </div>
    );
  }

  const totalArticles =
    enrichment.company_news.length +
    enrichment.market_context.length +
    enrichment.product_mentions.length;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Newspaper className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Business Context</h3>
            <p className="text-sm text-gray-500">
              {enrichment.from_cache ? 'Cached' : 'Fresh'} · {totalArticles} articles
            </p>
          </div>
        </div>
        <button
          onClick={() => loadEnrichment(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="space-y-6">
        <ArticleSection
          title="Company News"
          icon={Building2}
          articles={enrichment.company_news}
          emptyMessage="No recent company news found"
          color="text-purple-700"
        />

        <ArticleSection
          title="Market Context"
          icon={TrendingUp}
          articles={enrichment.market_context}
          emptyMessage="No market context articles found"
          color="text-blue-700"
        />

        <ArticleSection
          title="Product Mentions"
          icon={Package}
          articles={enrichment.product_mentions}
          emptyMessage="No product mentions found"
          color="text-green-700"
        />
      </div>

      {totalArticles > 0 && (
        <p className="mt-6 text-xs text-gray-500 text-center">
          Data from the last 2 years · Powered by Exa AI
        </p>
      )}
    </div>
  );
}
