import { useState } from 'react';
import { Calendar, AlertTriangle, CheckCircle2, TrendingUp, Clock, FileText, DollarSign, ExternalLink, Eye, Download, FolderPlus, ChevronDown, Copy, Check, Quote, Tag } from 'lucide-react';
import EnrichmentPanel from './EnrichmentPanel';

interface Portfolio {
  id: string;
  name: string;
  description?: string;
}

interface MaintenanceFee {
  due_date: string;
  window_start: string;
  window_end: string;
  surcharge_end: string;
}

interface MaintenanceFees {
  year_3_5: MaintenanceFee;
  year_7_5: MaintenanceFee;
  year_11_5: MaintenanceFee;
}

interface PatentAnalysis {
  patent_id: string;
  full_id?: string;
  title: string;
  abstract?: string;
  patent_type?: string;
  num_claims?: number;
  filing_date?: string;
  grant_date?: string;
  assignees?: Array<{ assignee_organization: string }>;
  inventors?: Array<{ inventor_name_first: string; inventor_name_last: string }>;
  dates: {
    filed: string;
    granted: string;
    baseline_expiry: string;
    calculated_expiry: string;
    pta_days: number;
    pte_days: number;
    is_filing_estimated?: boolean;
  };
  maintenance_fees?: MaintenanceFees;
  expiration?: {
    expiry: string;
    reason: string;
    is_active: boolean;
  };
  warnings: {
    terminal_disclaimer?: boolean;
    td_date?: string;
    fee_status: string;
    reason: string;
    is_application_warning?: string;
  };
  is_active: boolean;
  is_application?: boolean;
  source: string;
  url?: string;
  from_cache?: boolean;
  cached_at?: string;
  cpc_codes?: Array<{ cpc_group_id: string; cpc_group_title?: string }>;
}

interface PatentTimelineProps {
  analysis: PatentAnalysis;
  onAddToWatchlist?: () => void;
  onExport?: (format: 'json' | 'csv') => void;
  portfolios?: Portfolio[];
  onAddToPortfolio?: (portfolioId: string) => void;
  isWatchlisted?: boolean;
}

export default function PatentTimeline({ analysis, onAddToWatchlist, onExport, portfolios, onAddToPortfolio, isWatchlisted = false }: PatentTimelineProps) {
  const [showPortfolioMenu, setShowPortfolioMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedCitation, setCopiedCitation] = useState(false);
  const [copiedExpiry, setCopiedExpiry] = useState(false);
  const isApplication = analysis.is_application === true;

  const getPatentUrl = () => {
    const fullId = getFullPatentId();
    return `https://patents.google.com/patent/${fullId}`;
  };

  const getFullPatentId = () => {
    const id = analysis.patent_id || analysis.full_id || '';
    return id.toUpperCase().startsWith('US') ? id : `US${id}`;
  };

  const generateCitation = () => {
    const assignee = analysis.assignees?.[0]?.assignee_organization || 'Unknown Assignee';
    const year = analysis.dates.granted ? new Date(analysis.dates.granted).getFullYear() : '';
    return `${assignee}, "${analysis.title}," ${getFullPatentId()}, ${year}.`;
  };

  const handleCopyPatentId = async () => {
    try {
      await navigator.clipboard.writeText(getFullPatentId());
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyCitation = async () => {
    try {
      await navigator.clipboard.writeText(generateCitation());
      setCopiedCitation(true);
      setTimeout(() => setCopiedCitation(false), 2000);
    } catch (err) {
      console.error('Failed to copy citation:', err);
    }
  };

  const handleCopyExpiry = async () => {
    if (!analysis.dates.calculated_expiry) return;
    try {
      const expiryText = `${getFullPatentId()} expires ${formatDate(analysis.dates.calculated_expiry)}`;
      await navigator.clipboard.writeText(expiryText);
      setCopiedExpiry(true);
      setTimeout(() => setCopiedExpiry(false), 2000);
    } catch (err) {
      console.error('Failed to copy expiry:', err);
    }
  };

  const formatCacheTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const parseLocalDate = (dateStr: string): Date => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(dateStr);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Unknown';
    return parseLocalDate(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculatePosition = (date: string, startDate: string, endDate: string) => {
    const start = parseLocalDate(startDate).getTime();
    const end = parseLocalDate(endDate).getTime();
    const current = parseLocalDate(date).getTime();
    return Math.min(100, Math.max(0, ((current - start) / (end - start)) * 100));
  };

  const getDaysUntil = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const target = parseLocalDate(dateStr);
    const now = new Date();
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getFeeStatus = (fee: MaintenanceFee | undefined) => {
    if (!fee) return { status: 'unknown', label: 'Unknown', color: 'text-gray-500' };

    const now = new Date();
    const dueDate = new Date(fee.due_date);
    const surchargeEnd = new Date(fee.surcharge_end);
    const windowStart = new Date(fee.window_start);

    if (now > surchargeEnd) {
      return { status: 'past', label: 'Deadline Passed', color: 'text-gray-500' };
    }
    if (now > dueDate) {
      return { status: 'surcharge', label: 'Surcharge Period', color: 'text-orange-600' };
    }
    if (now >= windowStart) {
      return { status: 'open', label: 'Window Open', color: 'text-blue-600' };
    }
    return { status: 'future', label: 'Upcoming', color: 'text-gray-600' };
  };

  const filedDate = analysis.dates.filed ? parseLocalDate(analysis.dates.filed) : null;
  const grantedDate = analysis.dates.granted ? parseLocalDate(analysis.dates.granted) : null;
  const expiryDate = analysis.dates.calculated_expiry ? parseLocalDate(analysis.dates.calculated_expiry) : null;
  const today = new Date();

  const daysUntilExpiry = getDaysUntil(analysis.dates.calculated_expiry);
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 365;

  const HeaderSection = () => (
    <div className={`px-6 py-4 border-b ${
      isApplication ? 'bg-amber-50 border-amber-200' :
      isExpired ? 'bg-red-50 border-red-200' :
      isExpiringSoon ? 'bg-orange-50 border-orange-200' :
      analysis.is_active ? 'bg-green-50 border-green-200' :
      'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              isApplication ? 'bg-amber-100 text-amber-800' :
              isExpired ? 'bg-red-100 text-red-800' :
              isExpiringSoon ? 'bg-orange-100 text-orange-800' :
              analysis.is_active ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {isApplication ? 'Pending Application' :
               isExpired ? 'Expired' :
               isExpiringSoon ? 'Expiring Soon' :
               analysis.is_active ? 'Active' : 'Status Unknown'}
            </span>
            {analysis.from_cache && (
              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200" title={analysis.cached_at ? `Cached ${formatCacheTime(analysis.cached_at)}` : 'Cached result'}>
                Instant {analysis.cached_at && `(${formatCacheTime(analysis.cached_at)})`}
              </span>
            )}
            <span className="text-xs text-gray-500">
              via {analysis.source === 'patentsview' ? 'USPTO PatentsView' : analysis.source}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{analysis.title}</h2>
          <div className="flex items-center gap-2">
            <p className="text-gray-600 font-mono">{getFullPatentId()}</p>
            <button
              onClick={handleCopyPatentId}
              className="p-1 hover:bg-white/50 rounded transition-colors"
              title="Copy patent ID"
            >
              {copiedId ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {onAddToWatchlist && (
            <button
              onClick={onAddToWatchlist}
              disabled={isWatchlisted}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                isWatchlisted
                  ? 'bg-green-100 text-green-700 border border-green-300 cursor-default'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
              }`}
            >
              {isWatchlisted ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Watching
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Watch
                </>
              )}
            </button>
          )}
          {portfolios && portfolios.length > 0 && onAddToPortfolio && (
            <div className="relative">
              <button
                onClick={() => setShowPortfolioMenu(!showPortfolioMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                Add to Portfolio
                <ChevronDown className="w-3 h-3" />
              </button>
              {showPortfolioMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {portfolios.map(portfolio => (
                    <button
                      key={portfolio.id}
                      onClick={() => {
                        onAddToPortfolio(portfolio.id);
                        setShowPortfolioMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      {portfolio.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {onExport && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors border border-gray-200"
              >
                <Download className="w-4 h-4" />
                Export
                <ChevronDown className="w-3 h-3" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => {
                      onExport('csv');
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => {
                      onExport('json');
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Export as JSON
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleCopyCitation}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              copiedCitation
                ? 'bg-green-100 text-green-700 border-green-300'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
            }`}
            title="Copy citation"
          >
            {copiedCitation ? (
              <Check className="w-4 h-4" />
            ) : (
              <Quote className="w-4 h-4" />
            )}
            {copiedCitation ? 'Copied' : 'Cite'}
          </button>
          <a
            href={getPatentUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            title="View full patent document"
          >
            <ExternalLink className="w-4 h-4" />
            View Full Patent
          </a>
        </div>
      </div>
    </div>
  );

  if (isApplication) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <HeaderSection />
        <div className="p-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 mb-6">
            <FileText className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 mb-2">Patent Application - Not Yet Granted</p>
              <p className="text-sm text-amber-800">
                This is a published patent application, not a granted patent. Patent applications do not have expiration dates.
                Once granted, the patent will expire 20 years from the filing date, plus any Patent Term Adjustment (PTA).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {filedDate && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Filing Date</span>
                </div>
                <p className="text-lg font-semibold text-gray-900">{formatDate(analysis.dates.filed)}</p>
                {analysis.dates.is_filing_estimated && (
                  <p className="text-xs text-amber-600 mt-1">Estimated</p>
                )}
              </div>
            )}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">If Granted, Would Expire</span>
              </div>
              <p className="text-lg font-semibold text-blue-900">
                {filedDate ? formatDate(new Date(filedDate.getTime() + 20 * 365.25 * 24 * 60 * 60 * 1000).toISOString()) : 'Unknown'}
              </p>
              <p className="text-xs text-blue-700 mt-1">+ any PTA days</p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900 font-semibold mb-2">What happens if this application is granted?</p>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>The patent would expire 20 years from the filing date</li>
              <li>Additional Patent Term Adjustment (PTA) days may be added for USPTO delays</li>
              <li>Maintenance fees would be due at 3.5, 7.5, and 11.5 years after grant</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (!filedDate || !grantedDate || !expiryDate) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <HeaderSection />
        <div className="p-6">
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Incomplete Data</h3>
            <p className="text-gray-600">Unable to display complete timeline due to missing date information.</p>
          </div>
        </div>
      </div>
    );
  }

  const timelineStart = filedDate;
  const timelineEnd = expiryDate;
  const grantPos = calculatePosition(analysis.dates.granted, timelineStart.toISOString(), timelineEnd.toISOString());
  const todayPos = calculatePosition(today.toISOString(), timelineStart.toISOString(), timelineEnd.toISOString());

  const fees = analysis.maintenance_fees;
  const fee35Date = fees?.year_3_5?.due_date ? new Date(fees.year_3_5.due_date) : new Date(grantedDate.getTime() + 3.5 * 365.25 * 24 * 60 * 60 * 1000);
  const fee75Date = fees?.year_7_5?.due_date ? new Date(fees.year_7_5.due_date) : new Date(grantedDate.getTime() + 7.5 * 365.25 * 24 * 60 * 60 * 1000);
  const fee115Date = fees?.year_11_5?.due_date ? new Date(fees.year_11_5.due_date) : new Date(grantedDate.getTime() + 11.5 * 365.25 * 24 * 60 * 60 * 1000);

  const fee35Pos = calculatePosition(fee35Date.toISOString(), timelineStart.toISOString(), timelineEnd.toISOString());
  const fee75Pos = calculatePosition(fee75Date.toISOString(), timelineStart.toISOString(), timelineEnd.toISOString());
  const fee115Pos = calculatePosition(fee115Date.toISOString(), timelineStart.toISOString(), timelineEnd.toISOString());

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <HeaderSection />

      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">Filed</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">{formatDate(analysis.dates.filed)}</p>
            {analysis.dates.is_filing_estimated && (
              <p className="text-xs text-amber-600 mt-1">Estimated</p>
            )}
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Granted</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">{formatDate(analysis.dates.granted)}</p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Adjustments</span>
            </div>
            <p className="text-lg font-semibold text-blue-600">
              +{(analysis.dates.pta_days || 0) + (analysis.dates.pte_days || 0)} days
            </p>
            <p className="text-xs text-gray-600 mt-1">
              PTA: {analysis.dates.pta_days || 0} | PTE: {analysis.dates.pte_days || 0}
            </p>
          </div>

          <div className={`rounded-lg p-4 ${
            isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-orange-50' : 'bg-gray-50'
          }`}>
            <div className={`flex items-center justify-between mb-1`}>
              <div className={`flex items-center gap-2 ${
                isExpired ? 'text-red-600' : isExpiringSoon ? 'text-orange-600' : 'text-gray-600'
              }`}>
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Expires</span>
              </div>
              <button
                onClick={handleCopyExpiry}
                className="p-1 hover:bg-white/50 rounded transition-colors"
                title="Copy expiration info"
              >
                {copiedExpiry ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                )}
              </button>
            </div>
            <p className={`text-lg font-semibold ${
              isExpired ? 'text-red-700' : isExpiringSoon ? 'text-orange-700' : 'text-gray-900'
            }`}>
              {formatDate(analysis.dates.calculated_expiry)}
            </p>
            {daysUntilExpiry !== null && (
              <p className={`text-xs mt-1 ${
                isExpired ? 'text-red-600' : isExpiringSoon ? 'text-orange-600' : 'text-gray-600'
              }`}>
                {isExpired ? `Expired ${Math.abs(daysUntilExpiry)} days ago` : `${daysUntilExpiry} days remaining`}
              </p>
            )}
          </div>
        </div>

        {analysis.warnings.terminal_disclaimer && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 mb-6">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Terminal Disclaimer Filed</p>
              <p className="text-sm text-amber-800">
                This patent has a terminal disclaimer. Its expiration may be tied to another patent.
              </p>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Patent Lifecycle Timeline</h3>
          <div className="relative pt-10 pb-16 px-4">
            <div className="absolute top-14 left-4 right-4 h-3 bg-gradient-to-r from-blue-300 via-green-300 to-red-300 rounded-full shadow-inner" />

            <div className="absolute top-11 h-9 w-0.5 bg-blue-600 z-10" style={{ left: '16px' }}>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
                <div className="text-xs font-semibold text-blue-700">Filed</div>
                <div className="text-xs text-gray-600">{formatDate(analysis.dates.filed)}</div>
              </div>
            </div>

            <div className="absolute top-11 h-9 w-0.5 bg-green-600 z-10" style={{ left: `calc(${grantPos}% + 16px * (1 - ${grantPos}/100) - 16px * ${grantPos}/100)` }}>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
                <div className="text-xs font-semibold text-green-700">Granted</div>
                <div className="text-xs text-gray-600">{formatDate(analysis.dates.granted)}</div>
              </div>
            </div>

            {todayPos > 0 && todayPos < 100 && (
              <div className="absolute top-10 h-10 w-1 bg-gray-900 z-20 rounded" style={{ left: `calc(${todayPos}% + 16px * (1 - ${todayPos}/100) - 16px * ${todayPos}/100)` }}>
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <div className="text-xs font-bold text-gray-900 bg-white px-1 rounded">Today</div>
                </div>
              </div>
            )}

            {[
              { pos: fee35Pos, date: fee35Date, label: '3.5yr', fee: fees?.year_3_5 },
              { pos: fee75Pos, date: fee75Date, label: '7.5yr', fee: fees?.year_7_5 },
              { pos: fee115Pos, date: fee115Date, label: '11.5yr', fee: fees?.year_11_5 },
            ].filter(f => f.pos > 0 && f.pos < 100).map(({ pos, date, label, fee }) => {
              const status = getFeeStatus(fee);
              const isPast = status.status === 'past';
              return (
                <div
                  key={label}
                  className="absolute top-[60px]"
                  style={{ left: `calc(${pos}% + 16px * (1 - ${pos}/100) - 16px * ${pos}/100)` }}
                >
                  <div className={`w-3 h-3 rounded-full border-2 border-white shadow ${isPast ? 'bg-gray-400' : 'bg-amber-500'}`} />
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
                    <div className={`text-xs font-medium ${status.color}`}>{label} Fee</div>
                    <div className="text-xs text-gray-500">{formatDate(date.toISOString())}</div>
                  </div>
                </div>
              );
            })}

            <div className="absolute top-11 right-4 h-9 w-0.5 bg-red-600 z-10">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
                <div className="text-xs font-semibold text-red-700">Expires</div>
                <div className="text-xs text-gray-600">{formatDate(analysis.dates.calculated_expiry)}</div>
              </div>
            </div>
          </div>
        </div>

        {fees && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-600" />
              Maintenance Fee Schedule
            </h3>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-amber-800 text-sm">
                <strong>Warning:</strong> {analysis.warnings?.fee_status}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'year_3_5', label: '3.5 Year Fee', fee: fees.year_3_5 },
                { key: 'year_7_5', label: '7.5 Year Fee', fee: fees.year_7_5 },
                { key: 'year_11_5', label: '11.5 Year Fee', fee: fees.year_11_5 },
              ].map(({ key, label, fee }) => {
                const status = getFeeStatus(fee);
                const isPast = status.status === 'past';
                return (
                  <div
                    key={key}
                    className={`bg-white border rounded-lg p-4 ${
                      isPast ? 'border-gray-200 opacity-60' :
                      status.status === 'surcharge' ? 'border-orange-300 bg-orange-50' :
                      status.status === 'open' ? 'border-blue-300 bg-blue-50' :
                      'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{label}</h4>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        isPast ? 'bg-gray-100 text-gray-600' :
                        status.status === 'surcharge' ? 'bg-orange-100 text-orange-700' :
                        status.status === 'open' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-500">Due:</span> <span className="font-medium">{formatDate(fee?.due_date)}</span></p>
                      <p><span className="text-gray-500">Window opens:</span> {formatDate(fee?.window_start)}</p>
                      <p><span className="text-gray-500">Grace period ends:</span> {formatDate(fee?.surcharge_end)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {analysis.assignees && analysis.assignees.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Assignee</h4>
              <p className="text-gray-900">{analysis.assignees.map(a => a.assignee_organization).filter(Boolean).join(', ') || 'Not available'}</p>
            </div>
          )}
          {analysis.inventors && analysis.inventors.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Inventors</h4>
              <p className="text-gray-900">{analysis.inventors.map(i => `${i.inventor_name_first || ''} ${i.inventor_name_last || ''}`.trim()).filter(Boolean).join(', ') || 'Not available'}</p>
            </div>
          )}
          {analysis.num_claims && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Number of Claims</h4>
              <p className="text-gray-900">{analysis.num_claims}</p>
            </div>
          )}
          {analysis.patent_type && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Patent Type</h4>
              <p className="text-gray-900 capitalize">{analysis.patent_type}</p>
            </div>
          )}
        </div>

        {analysis.cpc_codes && analysis.cpc_codes.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Technology Classifications (CPC)
            </h4>
            <div className="flex flex-wrap gap-2">
              {analysis.cpc_codes.slice(0, 8).map((cpc, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-mono rounded-md"
                  title={cpc.cpc_group_title || cpc.cpc_group_id}
                >
                  {cpc.cpc_group_id}
                </span>
              ))}
              {analysis.cpc_codes.length > 8 && (
                <span className="text-xs text-gray-500 py-1">
                  +{analysis.cpc_codes.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}

        {analysis.abstract && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Abstract</h4>
            <p className="text-gray-700 text-sm leading-relaxed">{analysis.abstract}</p>
          </div>
        )}

        {/* Business Context - Exa AI Enrichment */}
        <div className="mb-6">
          <EnrichmentPanel
            patentId={analysis.patent_id}
            patentTitle={analysis.title}
            assignee={analysis.assignees?.[0]?.assignee_organization}
          />
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-700 font-semibold mb-2">Important Disclaimers</p>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li><strong>Maintenance Fees:</strong> Cannot verify if fees have been paid. Patent may have lapsed.</li>
            {analysis.dates.is_filing_estimated && (
              <li><strong>Filing Date:</strong> Estimated. Actual date may differ.</li>
            )}
            <li><strong>Calculation:</strong> {analysis.warnings?.reason || 'Based on 20 years from filing date'}</li>
            <li><strong>Legal Advice:</strong> This is an estimate only. Consult a patent attorney for legal matters.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
