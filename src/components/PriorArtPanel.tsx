import { useState } from 'react';
import { History, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Search, Sparkles, Zap } from 'lucide-react';
import { discoverPriorArt, PriorArtResult } from '../lib/api';
import { Skeleton } from './Skeleton';
import { AIDisclaimer } from './AIDisclaimer';

type PriorArtCandidate = PriorArtResult['prior_art_candidates'][number];

interface PriorArtPanelProps {
  patentId: string;
  patentTitle: string;
  patentAbstract: string;
  filingDate?: string;
}

function RelevanceBar({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 75) return 'bg-red-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${score >= 75 ? 'text-red-600' : score >= 50 ? 'text-yellow-600' : 'text-gray-500'}`}>
        {score}%
      </span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
      {children}
    </span>
  );
}

function CandidateCard({ candidate, onAnalyze }: { candidate: PriorArtCandidate; onAnalyze?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => onAnalyze?.(candidate.patent_id)}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            {candidate.patent_id}
          </button>
          <h4 className="text-sm text-gray-900 font-medium mt-1 line-clamp-2">
            {candidate.patent_title}
          </h4>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-xs text-gray-500 mb-1">Relevance Score</p>
        <RelevanceBar score={candidate.relevance_score} />
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 mb-2"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? 'Hide' : 'Show'} overlap details
      </button>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-sm text-gray-700 mb-3">{candidate.overlap_summary}</p>
        </div>
      )}

      {candidate.key_matching_elements.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {candidate.key_matching_elements.map((element: string, i: number) => (
            <Chip key={i}>{element}</Chip>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-lg">
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="flex flex-wrap gap-2 mb-3">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-28 mb-2" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="border border-gray-200 rounded-lg p-4">
          <Skeleton className="h-5 w-28 mb-2" />
          <Skeleton className="h-4 w-3/4 mb-3" />
          <Skeleton className="h-2 w-full rounded-full mb-2" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PriorArtPanel({
  patentId,
  patentTitle,
  patentAbstract,
  filingDate,
}: PriorArtPanelProps) {
  const [result, setResult] = useState<PriorArtResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const fetchPriorArt = async () => {
    setHasStarted(true);
    setLoading(true);
    setError(null);

    try {
      const data = await discoverPriorArt(patentId, patentTitle, patentAbstract, filingDate);

      if (data.available === false) {
        setError(data.error || 'Prior art discovery unavailable');
        setResult(null);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover prior art');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzePatent = (id: string) => {
    window.open(`/analyze/${id}`, '_blank');
  };

  if (!hasStarted) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <Search className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Prior Art Discovery</h3>
                <p className="text-sm text-gray-500">AI-powered patent search agent</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Powered by Gemini 3</span>
            </div>
          </div>
        </div>
        <div className="p-6 text-center">
          <Search className="w-12 h-12 text-purple-300 mx-auto mb-3" />
          <p className="text-gray-600 text-sm mb-4 max-w-sm mx-auto">
            Discover patents filed before this one that may be relevant prior art.
          </p>
          <button
            onClick={fetchPriorArt}
            className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
          >
            Discover Prior Art
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 rounded">
              <History className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Prior Art Discovery</h3>
              <div className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span className="text-xs text-gray-500">Powered by Gemini 3</span>
              </div>
            </div>
          </div>

          <button
            onClick={fetchPriorArt}
            disabled={loading}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Refresh prior art search"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Loading State */}
        {loading && <LoadingSkeleton />}

        {/* Error State */}
        {error && !loading && (
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 font-medium">{error}</p>
              <button
                onClick={fetchPriorArt}
                className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 mt-2 font-medium"
              >
                <RefreshCw className="w-3 h-3" />
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {result && result.prior_art_candidates.length === 0 && !loading && (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600 font-medium">No prior art found</p>
            <p className="text-xs text-gray-500 mt-1">
              No relevant prior art was discovered for this patent.
            </p>
          </div>
        )}

        {/* Results */}
        {result && result.prior_art_candidates.length > 0 && !loading && (
          <div className="space-y-4">
            {/* Search Strategy Card */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Search Strategy
              </h4>

              {result.key_concepts.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1.5">Key Concepts</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.key_concepts.map((concept: string, i: number) => (
                      <Chip key={i}>{concept}</Chip>
                    ))}
                  </div>
                </div>
              )}

              {result.search_strategy.keywords.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1.5">Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.search_strategy.keywords.map((kw, i) => (
                      <Chip key={i}>{kw}</Chip>
                    ))}
                  </div>
                </div>
              )}

              {result.search_strategy.cpc_codes.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1.5">CPC Codes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.search_strategy.cpc_codes.map((code, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 text-xs font-mono bg-blue-50 text-blue-700 rounded">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.search_strategy.date_range?.before && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Date Range</p>
                  <p className="text-sm text-gray-700">
                    Before {new Date(result.search_strategy.date_range.before).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {/* Prior Art Candidates */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Prior Art Candidates ({result.prior_art_candidates.length})
              </h4>
              <div className="space-y-3">
                {result.prior_art_candidates
                  .sort((a: PriorArtCandidate, b: PriorArtCandidate) => b.relevance_score - a.relevance_score)
                  .slice(0, 10)
                  .map((candidate: PriorArtCandidate) => (
                    <CandidateCard
                      key={candidate.patent_id}
                      candidate={candidate}
                      onAnalyze={handleAnalyzePatent}
                    />
                  ))}
              </div>
            </div>

            {/* Analysis Summary */}
            {result.analysis_summary && (
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                <h4 className="text-xs font-semibold text-indigo-800 uppercase tracking-wide mb-2">
                  Analysis Summary
                </h4>
                <p className="text-sm text-indigo-900 leading-relaxed">
                  {result.analysis_summary}
                </p>
              </div>
            )}

            {/* Disclaimer & Timestamp */}
            <AIDisclaimer compact className="mt-4" />
            <p className="text-xs text-gray-400 text-right mt-2">
              Generated: {new Date(result.generated_at).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
