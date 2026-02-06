import { X, Clock, CheckCircle2, AlertTriangle, Copy, Check, Brain, Loader2, Shield, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getAIPatentComparison, AICompareResult } from '../lib/api';
import FTORiskAnalyzer from './FTORiskAnalyzer';
import { AIDisclaimer } from './AIDisclaimer';

const MAX_COMPARISON_PATENTS = 5;

interface ComparisonPatent {
  patent_id: string;
  patent_title: string;
  patent_abstract: string;
  patent_date: string;
  filing_date?: string;
  expiration_date?: string;
  is_active?: boolean;
  assignees?: Array<{ assignee_organization: string }>;
}

interface PatentComparisonProps {
  patents: ComparisonPatent[];
  onClose: () => void;
  onRemove: (patentId: string) => void;
  onClearAll?: () => void;
  onAnalyze: (patentId: string) => void;
}

export default function PatentComparison({ patents, onClose, onRemove, onClearAll, onAnalyze }: PatentComparisonProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [aiComparison, setAiComparison] = useState<AICompareResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showFTOAnalyzer, setShowFTOAnalyzer] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysUntil = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const now = new Date();
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const calculateExpiry = (filingDate: string | undefined, grantDate: string | undefined) => {
    if (filingDate) {
      const filing = new Date(filingDate);
      const expiry = new Date(filing);
      expiry.setFullYear(expiry.getFullYear() + 20);
      return expiry.toISOString().split('T')[0];
    }
    if (grantDate) {
      const grant = new Date(grantDate);
      const expiry = new Date(grant);
      expiry.setFullYear(expiry.getFullYear() + 20);
      return expiry.toISOString().split('T')[0];
    }
    return undefined;
  };

  const handleCopy = async (patentId: string) => {
    try {
      await navigator.clipboard.writeText(patentId);
      setCopiedId(patentId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Silently fail
    }
  };

  const getFullPatentId = (id: string) => {
    return id.toUpperCase().startsWith('US') ? id : `US${id}`;
  };

  const sortedPatents = [...patents].sort((a, b) => {
    const expiryA = a.expiration_date || calculateExpiry(a.filing_date, a.patent_date);
    const expiryB = b.expiration_date || calculateExpiry(b.filing_date, b.patent_date);
    if (!expiryA) return 1;
    if (!expiryB) return -1;
    return new Date(expiryA).getTime() - new Date(expiryB).getTime();
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Compare Patents ({patents.length})</h2>
            <p className="text-sm text-gray-600">Sorted by expiration date</p>
          </div>
          <div className="flex items-center gap-2">
            {onClearAll && patents.length > 0 && (
              <button
                onClick={onClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Patent count warnings */}
        {patents.length < 2 && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              Select at least <strong>2 patents</strong> to enable comparison features.
            </p>
          </div>
        )}

        {patents.length > MAX_COMPARISON_PATENTS && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              AI comparison is limited to <strong>{MAX_COMPARISON_PATENTS} patents</strong>. Only the first {MAX_COMPARISON_PATENTS} will be analyzed.
            </p>
          </div>
        )}

        {/* AI Compare Button */}
        {patents.length >= 2 && (
          <div className="px-6 py-4 flex flex-wrap gap-2">
            <button
              onClick={() => setShowFTOAnalyzer(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
            >
              <Shield className="w-4 h-4" />
              FTO Risk Analysis
            </button>
            <button
              onClick={async () => {
                if (aiLoading) return;
                setAiLoading(true);
                setAiError(null);
                try {
                  const patentsToCompare = patents.slice(0, MAX_COMPARISON_PATENTS);
                  const result = await getAIPatentComparison(
                    patentsToCompare.map(p => ({
                      patent_id: p.patent_id,
                      patent_title: p.patent_title,
                      patent_abstract: p.patent_abstract || '',
                      assignee: p.assignees?.[0]?.assignee_organization,
                    }))
                  );
                  if (result.available === false) {
                    setAiError(result.reason || result.error || 'AI comparison unavailable');
                  } else {
                    setAiComparison(result);
                  }
                } catch (err) {
                  setAiError(err instanceof Error ? err.message : 'Comparison failed');
                } finally {
                  setAiLoading(false);
                }
              }}
              disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {aiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Brain className="w-4 h-4" />
              )}
              {aiLoading ? 'Comparing with AI...' : 'AI Compare Patents'}
            </button>
          </div>
        )}

        {/* AI Loading State */}
        {aiLoading && (
          <div className="mx-6 mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
              <span className="font-medium text-indigo-900">Analyzing patents with AI...</span>
            </div>
            <div className="text-sm text-indigo-700">
              Comparing {Math.min(patents.length, MAX_COMPARISON_PATENTS)} patents:
            </div>
            <ul className="mt-2 space-y-1">
              {patents.slice(0, MAX_COMPARISON_PATENTS).map((p, i) => (
                <li key={p.patent_id} className="flex items-center gap-2 text-sm text-indigo-800">
                  <span className="w-5 h-5 flex items-center justify-center bg-indigo-200 text-indigo-700 rounded-full text-xs font-medium">
                    {i + 1}
                  </span>
                  <span className="font-mono text-xs">{p.patent_id}</span>
                  <span className="text-indigo-600 truncate max-w-xs">{p.patent_title}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 h-1.5 bg-indigo-200 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* AI Error State */}
        {aiError && !aiLoading && (
          <div className="mx-6 mb-4 p-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{aiError}</p>

              {(aiError.toLowerCase().includes('too many') || aiError.toLowerCase().includes('rate limit') || aiError.toLowerCase().includes('429')) && (
                <p className="text-xs text-red-500 mt-1">
                  Our AI is busy. Please wait 30 seconds before trying again.
                </p>
              )}

              {aiError.toLowerCase().includes('sign in') && (
                <p className="text-xs text-red-500 mt-1">
                  Click <strong>Sign In</strong> in the top right to access this feature.
                </p>
              )}

              {!aiError.toLowerCase().includes('sign in') && (
                <button
                  onClick={() => setAiError(null)}
                  className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 mt-2 font-medium"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 font-semibold text-gray-700 border-b border-gray-200 min-w-[200px]">Patent</th>
                  <th className="text-left p-3 font-semibold text-gray-700 border-b border-gray-200">Assignee</th>
                  <th className="text-left p-3 font-semibold text-gray-700 border-b border-gray-200">Grant Date</th>
                  <th className="text-left p-3 font-semibold text-gray-700 border-b border-gray-200">Est. Expiration</th>
                  <th className="text-left p-3 font-semibold text-gray-700 border-b border-gray-200">Status</th>
                  <th className="text-left p-3 font-semibold text-gray-700 border-b border-gray-200 w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPatents.map((patent, index) => {
                  const fullId = getFullPatentId(patent.patent_id);
                  const estimatedExpiry = patent.expiration_date || calculateExpiry(patent.filing_date, patent.patent_date);
                  const daysRemaining = getDaysUntil(estimatedExpiry);
                  const isExpired = daysRemaining !== null && daysRemaining <= 0;
                  const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 365;

                  return (
                    <tr key={patent.patent_id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 border-b border-gray-100">
                        <div className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
                          {patent.patent_title}
                        </div>
                        <div className="flex items-center gap-1">
                          <code className="text-xs text-gray-500 font-mono">{fullId}</code>
                          <button
                            onClick={() => handleCopy(fullId)}
                            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                          >
                            {copiedId === fullId ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-sm text-gray-700">
                        {patent.assignees?.[0]?.assignee_organization || 'N/A'}
                      </td>
                      <td className="p-3 border-b border-gray-100 text-sm text-gray-700">
                        {formatDate(patent.patent_date)}
                      </td>
                      <td className="p-3 border-b border-gray-100">
                        <div className={`text-sm font-medium ${isExpired ? 'text-red-700' : isExpiringSoon ? 'text-orange-700' : 'text-gray-900'
                          }`}>
                          {formatDate(estimatedExpiry)}
                        </div>
                        {daysRemaining !== null && (
                          <div className={`text-xs ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-orange-600' : 'text-gray-500'
                            }`}>
                            {isExpired ? `Expired ${Math.abs(daysRemaining)}d ago` : `${daysRemaining}d remaining`}
                          </div>
                        )}
                      </td>
                      <td className="p-3 border-b border-gray-100">
                        {isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                            <AlertTriangle className="w-3 h-3" />
                            Likely Expired
                          </span>
                        ) : isExpiringSoon ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                            <Clock className="w-3 h-3" />
                            Expiring Soon
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                            <CheckCircle2 className="w-3 h-3" />
                            Likely Active
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-b border-gray-100">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              onClose();
                              onAnalyze(patent.patent_id);
                            }}
                            className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                          >
                            Analyze
                          </button>
                          <button
                            onClick={() => onRemove(patent.patent_id)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Remove from comparison"
                          >
                            <X className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {patents.length >= 2 && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Comparison Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-blue-700 font-medium">Earliest Expiration</div>
                  <div className="text-blue-900">
                    {sortedPatents[0] && formatDate(sortedPatents[0].expiration_date || calculateExpiry(sortedPatents[0].filing_date, sortedPatents[0].patent_date))}
                  </div>
                </div>
                <div>
                  <div className="text-blue-700 font-medium">Latest Expiration</div>
                  <div className="text-blue-900">
                    {sortedPatents[sortedPatents.length - 1] && formatDate(sortedPatents[sortedPatents.length - 1].expiration_date || calculateExpiry(sortedPatents[sortedPatents.length - 1].filing_date, sortedPatents[sortedPatents.length - 1].patent_date))}
                  </div>
                </div>
                <div>
                  <div className="text-blue-700 font-medium">Likely Active</div>
                  <div className="text-blue-900">
                    {patents.filter(p => {
                      const exp = p.expiration_date || calculateExpiry(p.filing_date, p.patent_date);
                      const days = getDaysUntil(exp);
                      return days !== null && days > 0;
                    }).length} of {patents.length}
                  </div>
                </div>
                <div>
                  <div className="text-blue-700 font-medium">Unique Assignees</div>
                  <div className="text-blue-900">
                    {new Set(patents.map(p => p.assignees?.[0]?.assignee_organization).filter(Boolean)).size}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Comparison Results - HIGH CONTRAST DESIGN */}
          {aiComparison && (
            <div className="mt-6 p-5 bg-white border-2 border-indigo-200 rounded-xl shadow-md">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-200">
                <div className="p-2 bg-indigo-600 rounded-lg">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">AI Comparison Analysis</h3>
                  <span className="text-xs text-gray-600">Powered by Gemini 3</span>
                </div>
              </div>

              <div className="space-y-5">
                {/* Overlap Analysis */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2">Overlap Analysis</h4>
                  <p className="text-base text-slate-800 leading-relaxed">{aiComparison.overlap_analysis}</p>
                </div>

                {/* Differentiation Matrix */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">Patent Differentiation</h4>
                  <div className="grid gap-3">
                    {aiComparison.differentiation_matrix.map((item, i) => (
                      <div key={i} className="bg-white border-2 border-gray-200 p-4 rounded-lg shadow-sm hover:border-indigo-300 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 flex items-center justify-center bg-indigo-600 text-white rounded-full text-xs font-bold">
                            {i + 1}
                          </span>
                          <span className="font-mono text-sm text-indigo-700 font-bold">{item.patent_id}</span>
                        </div>
                        <div className="text-gray-900">
                          <span className="font-semibold text-gray-700">Unique aspects:</span>{' '}
                          <span className="text-gray-800">{item.unique_aspects.join(', ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FTO Summary */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wide mb-2">FTO Considerations</h4>
                  <p className="text-base text-amber-900 leading-relaxed">{aiComparison.fto_summary}</p>
                </div>

                {/* Recommendation */}
                <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-lg">
                  <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wide mb-2">Strategic Recommendation</h4>
                  <p className="text-base text-emerald-900 font-medium leading-relaxed">{aiComparison.recommendation}</p>
                </div>
              </div>

              <AIDisclaimer compact className="mt-4" />

              <p className="text-xs text-gray-500 mt-3 pt-4 border-t border-gray-200 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Generated: {new Date(aiComparison.generated_at).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          Note: Expiration dates are estimates based on 20 years from filing. Actual dates may vary due to PTA, PTE, or maintenance fee status.
        </div>
      </div>

      {showFTOAnalyzer && (
        <FTORiskAnalyzer
          selectedPatents={patents.map(p => ({
            patent_id: p.patent_id,
            patent_title: p.patent_title,
            patent_abstract: p.patent_abstract,
          }))}
          onClose={() => setShowFTOAnalyzer(false)}
        />
      )}
    </div>
  );
}
