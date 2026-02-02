import { X, Clock, CheckCircle2, AlertTriangle, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ComparisonPatent {
  patent_id: string;
  patent_title: string;
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
  onAnalyze: (patentId: string) => void;
}

export default function PatentComparison({ patents, onClose, onRemove, onAnalyze }: PatentComparisonProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
            <h2 className="text-xl font-bold text-gray-900">Compare Patents</h2>
            <p className="text-sm text-gray-600">{patents.length} patents selected (sorted by expiration)</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

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
                        <div className={`text-sm font-medium ${
                          isExpired ? 'text-red-700' : isExpiringSoon ? 'text-orange-700' : 'text-gray-900'
                        }`}>
                          {formatDate(estimatedExpiry)}
                        </div>
                        {daysRemaining !== null && (
                          <div className={`text-xs ${
                            isExpired ? 'text-red-600' : isExpiringSoon ? 'text-orange-600' : 'text-gray-500'
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
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          Note: Expiration dates are estimates based on 20 years from filing. Actual dates may vary due to PTA, PTE, or maintenance fee status.
        </div>
      </div>
    </div>
  );
}
