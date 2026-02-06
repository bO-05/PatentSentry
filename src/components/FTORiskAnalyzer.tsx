import { useState, useEffect, useCallback } from 'react';
import {
  X,
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { analyzeFTORisk, FTOAnalysisResult } from '../lib/api';

type FTOPatentRisk = FTOAnalysisResult['patent_risks'][number];

interface FTORiskAnalyzerProps {
  selectedPatents: Array<{
    patent_id: string;
    patent_title: string;
    patent_abstract: string;
  }>;
  onClose: () => void;
}

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const riskConfig: Record<RiskLevel, { color: string; bg: string; border: string; icon: typeof ShieldCheck }> = {
  LOW: { color: 'text-green-700', bg: 'bg-green-100', border: 'border-green-300', icon: ShieldCheck },
  MEDIUM: { color: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-300', icon: Shield },
  HIGH: { color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-300', icon: ShieldAlert },
  CRITICAL: { color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-300', icon: ShieldX },
};

function RiskBadge({ level, size = 'md' }: { level: RiskLevel; size?: 'sm' | 'md' | 'lg' }) {
  const config = riskConfig[level];
  const Icon = config.icon;
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
  };
  const iconSizes = { sm: 'w-3 h-3', md: 'w-4 h-4', lg: 'w-5 h-5' };

  return (
    <span className={`inline-flex items-center font-semibold rounded-full ${config.bg} ${config.color} ${config.border} border ${sizeClasses[size]}`}>
      <Icon className={iconSizes[size]} />
      {level}
    </span>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const getColor = () => {
    if (clampedValue >= 80) return 'bg-green-500';
    if (clampedValue >= 60) return 'bg-yellow-500';
    if (clampedValue >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-300`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 w-10 text-right">{clampedValue}%</span>
    </div>
  );
}

function PatentAnalysisCard({
  analysis,
  isExpanded,
  onToggle,
}: {
  analysis: FTOPatentRisk;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <code className="text-sm font-mono text-indigo-600 font-medium">{analysis.patent_id}</code>
          <RiskBadge level={analysis.risk_level} size="sm" />
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 space-y-4">
          <div className="pt-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Confidence
            </div>
            <ConfidenceMeter value={analysis.confidence} />
          </div>

          {analysis.overlapping_elements.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Overlapping Elements
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.overlapping_elements.map((elem: string, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-1 bg-red-50 text-red-700 text-xs rounded-md border border-red-200"
                  >
                    {elem}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.non_overlapping_elements.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Non-Overlapping Elements
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.non_overlapping_elements.map((elem: string, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 text-xs rounded-md border border-green-200"
                  >
                    {elem}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.design_around_suggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                <Lightbulb className="w-3.5 h-3.5" />
                Design-Around Suggestions
              </div>
              <ul className="space-y-1.5 text-sm text-gray-700">
                {analysis.design_around_suggestions.map((suggestion: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function parseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    if (message.includes('timeout')) {
      return 'Request timed out. The analysis is taking longer than expected. Please try again.';
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (message.includes('unauthorized') || message.includes('401')) {
      return 'Authentication error. Please refresh the page and try again.';
    }
    if (message.includes('api key') || message.includes('gemini')) {
      return 'AI service temporarily unavailable. Please try again later.';
    }
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

export default function FTORiskAnalyzer({ selectedPatents, onClose }: FTORiskAnalyzerProps) {
  const [productDescription, setProductDescription] = useState('');
  const [patents, setPatents] = useState(selectedPatents);
  const [result, setResult] = useState<FTOAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPatents, setExpandedPatents] = useState<Set<string>>(new Set());

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  const handleRemovePatent = (patentId: string) => {
    setPatents(prev => prev.filter(p => p.patent_id !== patentId));
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

  const handleAnalyze = async () => {
    if (productDescription.length < 50 || patents.length === 0) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeFTORisk(productDescription, patents);
      if (data.available === false) {
        setError(data.error || 'FTO analysis unavailable');
      } else {
        setResult(data);
        setExpandedPatents(new Set(data.patent_risks.map((a: FTOPatentRisk) => a.patent_id)));
      }
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const canAnalyze = productDescription.length >= 50 && patents.length > 0;
  const isEmpty = patents.length === 0 && productDescription.length === 0 && !result;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-50 rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Shield className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Freedom to Operate Analysis</h2>
              <p className="text-sm text-gray-600">Powered by Gemini 3</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {/* Empty State */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-gray-100 rounded-full mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Select patents and describe your product
              </h3>
              <p className="text-gray-600 max-w-md">
                Add patents to analyze and provide a detailed description of your product or invention
                to receive a comprehensive FTO risk assessment.
              </p>
            </div>
          )}

          {/* Input Section */}
          {!result && !isEmpty && (
            <div className="space-y-6">
              {/* Product Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Describe your product or invention
                </label>
                <textarea
                  value={productDescription}
                  onChange={e => setProductDescription(e.target.value)}
                  placeholder="Provide a detailed technical description of your product, including key features, components, methods, and how it works... (minimum 50 characters)"
                  className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span className={productDescription.length < 50 ? 'text-amber-600' : 'text-green-600'}>
                    {productDescription.length < 50 ? `${50 - productDescription.length} more characters needed` : 'Ready to analyze'}
                  </span>
                  <span>{productDescription.length}/50 min</span>
                </div>
              </div>

              {/* Selected Patents */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Patents to analyze ({patents.length})
                </label>
                {patents.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-amber-800 text-sm">No patents selected. Add patents from search results to analyze FTO risk.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {patents.map(patent => (
                      <div
                        key={patent.patent_id}
                        className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <code className="text-xs font-mono text-indigo-600">{patent.patent_id}</code>
                          <p className="text-sm text-gray-900 line-clamp-1 mt-0.5">{patent.patent_title}</p>
                        </div>
                        <button
                          onClick={() => handleRemovePatent(patent.patent_id)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Analyze Button */}
              <button
                onClick={handleAnalyze}
                disabled={loading || productDescription.length < 50 || patents.length === 0}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Shield className="w-5 h-5" />
                {loading
                  ? 'Analyzing...'
                  : productDescription.length < 50
                    ? 'Enter description (50+ chars)'
                    : patents.length === 0
                      ? 'No patents selected'
                      : 'Analyze Risk'}
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-3" />
              <p className="text-gray-900 font-medium">Analyzing FTO Risk...</p>
              <p className="text-gray-500 text-sm">Comparing your product against {patents.length} patent{patents.length !== 1 ? 's' : ''}</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="p-4 bg-red-100 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analysis Failed</h3>
              <p className="text-gray-600 mb-4 text-center max-w-md">{error}</p>
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Analysis
              </button>
            </div>
          )}

          {/* Results Section */}
          {result && !loading && (
            <div className="space-y-6">
              {/* Overall Risk */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-600">Overall Risk:</span>
                <RiskBadge level={result.overall_risk} size="lg" />
              </div>

              {/* Product Summary */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Product Summary</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{result.product_summary}</p>
              </div>

              {/* Patent Analyses */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Patent Risk Analysis</h3>
                <div className="space-y-3">
                  {result.patent_risks.map((analysis: FTOPatentRisk) => (
                    <PatentAnalysisCard
                      key={analysis.patent_id}
                      analysis={analysis}
                      isExpanded={expandedPatents.has(analysis.patent_id)}
                      onToggle={() => togglePatentExpansion(analysis.patent_id)}
                    />
                  ))}
                </div>
              </div>

              {/* Strategic Recommendations */}
              {result.strategic_recommendations.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-indigo-600" />
                    Strategic Recommendations
                  </h3>
                  <ul className="space-y-2">
                    {result.strategic_recommendations.map((rec: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                        <span className="text-indigo-600 font-bold mt-0.5">{i + 1}.</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Generated timestamp */}
              <p className="text-xs text-gray-500 pt-4 border-t border-gray-200">
                Generated: {new Date(result.generated_at).toLocaleString()}
              </p>

              {/* New Analysis Button */}
              <button
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Start New Analysis
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-white text-xs text-gray-500">
          FTO analysis is for informational purposes only. Consult a patent attorney for legal advice.
        </div>
      </div>
    </div>
  );
}
