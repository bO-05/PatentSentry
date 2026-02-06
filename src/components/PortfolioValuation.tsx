import { useState, useEffect, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  RefreshCw,
  Download,
  Award,
  Zap,
  Target,
  Clock,
  Layers,
  Briefcase,
} from 'lucide-react';
import { getPortfolioValuation, PortfolioValueResult } from '../lib/api';
import { Skeleton } from './Skeleton';
import { AIDisclaimer } from './AIDisclaimer';

interface PortfolioValuationProps {
  portfolioId: string;
  portfolioName: string;
  patents: Array<{
    patent_id: string;
    patent_title: string;
    patent_abstract?: string;
    filing_date?: string;
    expiration_date?: string;
    assignee?: string;
  }>;
  onClose?: () => void;
}

type PortfolioStrength = 'WEAK' | 'MODERATE' | 'STRONG' | 'EXCEPTIONAL';
type PatentScore = PortfolioValueResult['patent_scores'][number];

const strengthConfig: Record<PortfolioStrength, { color: string; bg: string; border: string; text: string }> = {
  WEAK: { color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-300', text: 'Weak' },
  MODERATE: { color: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'Moderate' },
  STRONG: { color: 'text-green-700', bg: 'bg-green-100', border: 'border-green-300', text: 'Strong' },
  EXCEPTIONAL: { color: 'text-purple-700', bg: 'bg-purple-100', border: 'border-purple-300', text: 'Exceptional' },
};

function StrengthBadge({ strength }: { strength: PortfolioStrength }) {
  const config = strengthConfig[strength];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-full ${config.bg} ${config.color} ${config.border} border text-sm`}>
      <Award className="w-4 h-4" />
      {config.text}
    </span>
  );
}

function ScoreGauge({ score, size = 'lg' }: { score: number; size?: 'sm' | 'lg' }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const rotation = (clampedScore / 100) * 180 - 90;

  const getColor = () => {
    if (clampedScore >= 70) return { fill: '#22c55e', text: 'text-green-600' };
    if (clampedScore >= 40) return { fill: '#eab308', text: 'text-yellow-600' };
    return { fill: '#ef4444', text: 'text-red-600' };
  };

  const color = getColor();
  const dimensions = size === 'lg' ? { width: 160, height: 90, fontSize: '2.5rem' } : { width: 80, height: 45, fontSize: '1rem' };

  return (
    <div className="relative" style={{ width: dimensions.width, height: dimensions.height }}>
      <svg width={dimensions.width} height={dimensions.height} viewBox="0 0 160 90">
        <path
          d="M 10 80 A 70 70 0 0 1 150 80"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 10 80 A 70 70 0 0 1 150 80"
          fill="none"
          stroke={color.fill}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(clampedScore / 100) * 220} 220`}
        />
        <line
          x1="80"
          y1="80"
          x2="80"
          y2="25"
          stroke="#374151"
          strokeWidth="3"
          strokeLinecap="round"
          transform={`rotate(${rotation}, 80, 80)`}
        />
        <circle cx="80" cy="80" r="6" fill="#374151" />
      </svg>
      <div
        className={`absolute inset-0 flex items-end justify-center pb-1 font-bold ${color.text}`}
        style={{ fontSize: dimensions.fontSize }}
      >
        {Math.round(clampedScore)}
      </div>
    </div>
  );
}

function MiniProgressBar({ value, label, icon: Icon }: { value: number; label: string; icon: typeof Zap }) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const getColor = () => {
    if (clampedValue >= 70) return 'bg-green-500';
    if (clampedValue >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs text-gray-600 truncate">{label}</span>
          <span className="text-xs font-medium text-gray-700">{Math.round(clampedValue)}</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${getColor()} transition-all duration-300`} style={{ width: `${clampedValue}%` }} />
        </div>
      </div>
    </div>
  );
}

function OverallScoreBar({ value }: { value: number }) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const getColor = () => {
    if (clampedValue >= 70) return 'bg-green-500';
    if (clampedValue >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${getColor()} transition-all duration-300`} style={{ width: `${clampedValue}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-900 w-10 text-right">{Math.round(clampedValue)}</span>
    </div>
  );
}

function PatentScoreCard({
  score,
  isExpanded,
  onToggle,
}: {
  score: PatentScore;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <code className="text-sm font-mono text-indigo-600 font-medium flex-shrink-0">{score.patent_id}</code>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${score.overall_score >= 70 ? 'bg-green-100 text-green-700' :
              score.overall_score >= 40 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
              {Math.round(score.overall_score)}
            </div>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 space-y-4">
          <div className="pt-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Overall Score
            </div>
            <OverallScoreBar value={score.overall_score} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MiniProgressBar value={score.innovation_score} label="Innovation" icon={Zap} />
            <MiniProgressBar value={score.market_relevance_score} label="Market Relevance" icon={Target} />
            <MiniProgressBar value={score.remaining_life_score} label="Remaining Life" icon={Clock} />
            <MiniProgressBar value={score.claim_breadth_score} label="Claim Breadth" icon={Layers} />
          </div>

          {score.value_drivers.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Value Drivers
              </div>
              <div className="flex flex-wrap gap-1.5">
                {score.value_drivers.map((driver, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 text-xs rounded-md border border-green-200"
                  >
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {driver}
                  </span>
                ))}
              </div>
            </div>
          )}

          {score.risks.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Risks
              </div>
              <div className="flex flex-wrap gap-1.5">
                {score.risks.map((risk, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-1 bg-red-50 text-red-700 text-xs rounded-md border border-red-200"
                  >
                    <TrendingDown className="w-3 h-3 mr-1" />
                    {risk}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton({ patentCount }: { patentCount: number }) {
  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-full text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Evaluating {patentCount} patent{patentCount !== 1 ? 's' : ''} on 4 dimensions
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-6">
          <Skeleton className="w-40 h-24" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full mb-4" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PortfolioValuation({ portfolioId, portfolioName, patents, onClose }: PortfolioValuationProps) {
  const [result, setResult] = useState<PortfolioValueResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPatents, setExpandedPatents] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'score' | 'id'>('score');
  const [sortAsc, setSortAsc] = useState(false);

  const isEmpty = patents.length === 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!isEmpty) {
      handleAnalyze();
    }
  }, [portfolioId]);

  const handleAnalyze = async () => {
    if (isEmpty) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await getPortfolioValuation(
        patents.map(p => ({
          patent_id: p.patent_id,
          patent_title: p.patent_title,
          patent_abstract: p.patent_abstract || '',
          filing_date: p.filing_date,
          expiration_date: p.expiration_date,
          assignee: p.assignee,
        }))
      );
      if (data.available === false) {
        setError(data.error || 'Portfolio valuation unavailable');
      } else {
        setResult(data);
        if (data.patent_scores.length <= 5) {
          setExpandedPatents(new Set(data.patent_scores.map(s => s.patent_id)));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Valuation failed');
    } finally {
      setLoading(false);
    }
  };

  const togglePatentExpansion = (patentId: string) => {
    setExpandedPatents(prev => {
      const next = new Set(prev);
      if (next.has(patentId)) {
        next.delete(patentId);
      } else {
        next.add(patentId);
      }
      return next;
    });
  };

  const sortedScores = useMemo(() => {
    if (!result) return [];
    const scores = [...result.patent_scores];
    scores.sort((a, b) => {
      if (sortBy === 'score') {
        return sortAsc ? a.overall_score - b.overall_score : b.overall_score - a.overall_score;
      }
      return sortAsc ? a.patent_id.localeCompare(b.patent_id) : b.patent_id.localeCompare(a.patent_id);
    });
    return scores;
  }, [result, sortBy, sortAsc]);

  const handleSort = (by: 'score' | 'id') => {
    if (sortBy === by) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(by);
      setSortAsc(false);
    }
  };

  const handleExport = () => {
    if (!result) return;
    const csv = [
      ['Patent ID', 'Overall Score', 'Innovation', 'Market Relevance', 'Remaining Life', 'Claim Breadth', 'Value Drivers', 'Risks'].join(','),
      ...result.patent_scores.map(s => [
        s.patent_id,
        s.overall_score,
        s.innovation_score,
        s.market_relevance_score,
        s.remaining_life_score,
        s.claim_breadth_score,
        `"${s.value_drivers.join('; ')}"`,
        `"${s.risks.join('; ')}"`,
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-valuation-${portfolioId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-50 rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Award className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">{portfolioName}</h2>
                <span className="text-sm text-gray-500">• {patents.length} patents</span>
              </div>
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <span className="inline-flex items-center px-1.5 py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-medium rounded">
                  Powered by Gemini 3
                </span>
              </p>
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
          {/* Empty State */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-gray-100 rounded-full mb-4">
                <Briefcase className="w-16 h-16 text-gray-300" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Patents in Portfolio
              </h3>
              <p className="text-gray-500 mb-6 max-w-md">
                Add patents to this portfolio to see valuation analysis.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && <LoadingSkeleton patentCount={patents.length} />}

          {/* Error State */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="p-4 bg-red-100 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Valuation Failed</h3>
              <p className="text-gray-600 mb-4 text-center max-w-md">{error}</p>
              <button
                onClick={handleAnalyze}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          )}

          {/* Results Section */}
          {result && !loading && (
            <div className="space-y-6">
              {/* Portfolio Summary Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex flex-col items-center">
                    <ScoreGauge score={result.portfolio_summary.average_score} size="lg" />
                    <span className="text-sm text-gray-600 mt-1">Average Score</span>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">Portfolio Strength:</span>
                      <StrengthBadge strength={result.portfolio_summary.portfolio_strength} />
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">
                        Highest Value Patent
                      </div>
                      <code className="text-sm font-mono text-indigo-700 font-medium">
                        {result.portfolio_summary.highest_value_patent}
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Patent Scores */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Patent Scores</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSort('score')}
                      className={`text-xs px-2 py-1 rounded ${sortBy === 'score' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'} hover:bg-indigo-50 transition-colors`}
                    >
                      Score {sortBy === 'score' && (sortAsc ? '↑' : '↓')}
                    </button>
                    <button
                      onClick={() => handleSort('id')}
                      className={`text-xs px-2 py-1 rounded ${sortBy === 'id' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'} hover:bg-indigo-50 transition-colors`}
                    >
                      ID {sortBy === 'id' && (sortAsc ? '↑' : '↓')}
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {sortedScores.map(score => (
                    <PatentScoreCard
                      key={score.patent_id}
                      score={score}
                      isExpanded={expandedPatents.has(score.patent_id)}
                      onToggle={() => togglePatentExpansion(score.patent_id)}
                    />
                  ))}
                </div>
              </div>

              {/* Strategic Insights */}
              {result.strategic_insights.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-purple-600" />
                    Strategic Insights
                  </h3>
                  <ul className="space-y-2">
                    {result.strategic_insights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                        <span className="text-purple-600 font-bold mt-0.5">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Export Button */}
              <button
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export to CSV
              </button>

              {/* Generated timestamp */}
              <p className="text-xs text-gray-500 pt-4 border-t border-gray-200">
                Generated: {new Date(result.generated_at).toLocaleString()}
              </p>
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
