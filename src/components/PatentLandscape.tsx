import { useState } from 'react';
import {
  X,
  AlertTriangle,
  Globe,
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Layers,
  Lightbulb,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Target,
  Map,
} from 'lucide-react';
import { analyzeLandscape, LandscapeResult } from '../lib/api';
import { Skeleton } from './Skeleton';
import { AIDisclaimer } from './AIDisclaimer';

interface PatentLandscapeProps {
  query: string;
  patents: Array<{
    patent_id: string;
    patent_title: string;
    patent_abstract: string;
    assignee?: string;
    filing_date?: string;
  }>;
  onClose: () => void;
}

type AssigneeTrend = 'growing' | 'stable' | 'declining';
type ClusterMaturity = 'emerging' | 'growing' | 'mature' | 'declining';
type FilingTrend = 'increasing' | 'stable' | 'decreasing';

const trendConfig: Record<AssigneeTrend, { icon: typeof TrendingUp; color: string; label: string }> = {
  growing: { icon: TrendingUp, color: 'text-green-600', label: '↑ Growing' },
  stable: { icon: Minus, color: 'text-gray-500', label: '→ Stable' },
  declining: { icon: TrendingDown, color: 'text-red-500', label: '↓ Declining' },
};

const maturityConfig: Record<ClusterMaturity, { bg: string; text: string; border: string }> = {
  emerging: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  growing: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  mature: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  declining: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
};

const filingTrendConfig: Record<FilingTrend, { icon: typeof TrendingUp; color: string; bg: string }> = {
  increasing: { icon: TrendingUp, color: 'text-green-700', bg: 'bg-green-100' },
  stable: { icon: Minus, color: 'text-gray-600', bg: 'bg-gray-100' },
  decreasing: { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-100' },
};

function TrendIndicator({ trend }: { trend: AssigneeTrend }) {
  const config = trendConfig[trend];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function MaturityBadge({ maturity }: { maturity: ClusterMaturity }) {
  const config = maturityConfig[maturity];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} ${config.border} border capitalize`}>
      {maturity}
    </span>
  );
}

function AssigneeBar({ name, count, maxCount, focusAreas, trend }: {
  name: string;
  count: number;
  maxCount: number;
  focusAreas: string[];
  trend: AssigneeTrend;
}) {
  const widthPercent = Math.max((count / maxCount) * 100, 10);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-900 text-sm">{name}</span>
        </div>
        <TrendIndicator trend={trend} />
      </div>
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-md flex items-center justify-end pr-2 transition-all duration-500"
              style={{ width: `${widthPercent}%` }}
            >
              <span className="text-xs font-bold text-white">{count}</span>
            </div>
          </div>
        </div>
      </div>
      {focusAreas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {focusAreas.slice(0, 3).map((area, i) => (
            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md">
              {area}
            </span>
          ))}
          {focusAreas.length > 3 && (
            <span className="px-2 py-0.5 text-gray-400 text-xs">
              +{focusAreas.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TechnologyClusterCard({ cluster }: {
  cluster: LandscapeResult['technology_clusters'][number];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          <h4 className="font-medium text-gray-900 text-sm">{cluster.name}</h4>
        </div>
        <MaturityBadge maturity={cluster.maturity} />
      </div>
      <p className="text-sm text-gray-600 mb-3">{cluster.description}</p>
      {cluster.key_patents.length > 0 && (
        <div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Key Patents</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {cluster.key_patents.slice(0, 4).map((patent, i) => (
              <code key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded font-mono">
                {patent}
              </code>
            ))}
            {cluster.key_patents.length > 4 && (
              <span className="text-xs text-gray-400 self-center">+{cluster.key_patents.length - 4} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WhiteSpaceCard({ opportunity }: { opportunity: string }) {
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
      <div className="p-1.5 bg-amber-100 rounded-lg flex-shrink-0">
        <Target className="w-4 h-4 text-amber-600" />
      </div>
      <p className="text-sm text-gray-800">{opportunity}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <Skeleton className="h-5 w-40 mb-3" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6 mb-2" />
        <Skeleton className="h-4 w-4/6" />
      </div>

      <div>
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-6 w-full mb-2" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
              <Skeleton className="h-4 w-28 mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return 'The analysis took too long. Please try again with fewer patents.';
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    if (msg.includes('5 patents') || msg.includes('minimum')) {
      return 'At least 5 patents are required for landscape analysis.';
    }
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

export default function PatentLandscape({ query, patents, onClose }: PatentLandscapeProps) {
  const [result, setResult] = useState<LandscapeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const fetchLandscape = async () => {
    setHasStarted(true);
    setLoading(true);
    setError(null);

    try {
      const data = await analyzeLandscape(query, patents);
      if (data.available === false) {
        setError(data.error || 'Landscape analysis unavailable');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const maxPatentCount = result?.top_assignees.reduce((max, a) => Math.max(max, a.patent_count), 0) ?? 1;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Globe className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Patent Landscape Analysis</h2>
              <p className="text-sm text-gray-600">Powered by Gemini 3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {/* Ready State */}
          {!hasStarted && (
            <div className="text-center py-8">
              <Map className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Analyze Technology Landscape</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Get AI-powered insights on top assignees, technology clusters, filing trends, and white space opportunities.
              </p>
              {patents.length < 5 ? (
                <p className="text-amber-600 text-sm mb-4">Need at least 5 patents for landscape analysis ({patents.length} selected)</p>
              ) : null}
              <button
                onClick={fetchLandscape}
                disabled={patents.length < 5}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${patents.length >= 5
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
              >
                Generate Landscape Analysis
              </button>
            </div>
          )}

          {/* Loading State */}
          {hasStarted && loading && <LoadingSkeleton />}

          {/* Error State */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="p-4 bg-red-100 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analysis Failed</h3>
              <p className="text-gray-600 mb-4 text-center max-w-md">{error}</p>
              <button
                onClick={fetchLandscape}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Analysis
              </button>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div className="space-y-8">
              {/* Query Context */}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>Analyzing:</span>
                <code className="px-2 py-1 bg-gray-100 rounded text-indigo-600 font-medium">"{result.query}"</code>
                <span className="text-gray-400">•</span>
                <span>{patents.length} patents</span>
              </div>

              {/* Market Overview */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Market Overview</h3>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <p className="text-gray-700 leading-relaxed">{result.market_overview}</p>
                </div>
              </section>

              {/* Top Assignees */}
              {result.top_assignees.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Top Assignees</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.top_assignees.map((assignee, i) => (
                      <AssigneeBar
                        key={i}
                        name={assignee.name}
                        count={assignee.patent_count}
                        maxCount={maxPatentCount}
                        focusAreas={assignee.focus_areas}
                        trend={assignee.trend}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Technology Clusters */}
              {result.technology_clusters.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Technology Clusters</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.technology_clusters.map((cluster, i) => (
                      <TechnologyClusterCard key={i} cluster={cluster} />
                    ))}
                  </div>
                </section>
              )}

              {/* Filing Trends */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Filing Trends</h3>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-center gap-4 mb-3">
                    {(() => {
                      const config = filingTrendConfig[result.filing_trends.overall_trend];
                      const Icon = config.icon;
                      return (
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg} ${config.color} font-semibold`}>
                          <Icon className="w-4 h-4" />
                          {result.filing_trends.overall_trend.charAt(0).toUpperCase() + result.filing_trends.overall_trend.slice(1)}
                        </span>
                      );
                    })()}
                    {result.filing_trends.peak_year && (
                      <span className="text-sm text-gray-500">
                        Peak Year: <span className="font-semibold text-gray-700">{result.filing_trends.peak_year}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700">{result.filing_trends.insight}</p>
                </div>
              </section>

              {/* White Space Opportunities */}
              {result.white_space_opportunities.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <h3 className="text-lg font-semibold text-gray-900">White Space Opportunities</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {result.white_space_opportunities.map((opp, i) => (
                      <WhiteSpaceCard key={i} opportunity={opp} />
                    ))}
                  </div>
                </section>
              )}

              {/* Key Takeaways */}
              {result.key_takeaways.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Key Takeaways</h3>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5">
                    <ul className="space-y-2">
                      {result.key_takeaways.map((takeaway, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-800">{takeaway}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {/* Generated Timestamp */}
              <p className="text-xs text-gray-500 pt-4 border-t border-gray-200">
                Analysis Date: {result.analysis_date} • Generated: {new Date(result.generated_at).toLocaleString()}
              </p>

              {/* Refresh Button */}
              <button
                onClick={fetchLandscape}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Analysis
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-white">
          <AIDisclaimer compact />
        </div>
      </div>
    </div>
  );
}
