import { useState, useEffect } from 'react';
import { Eye, AlertTriangle, DollarSign, Clock, Trash2, RefreshCw, FolderPlus, Folder, BarChart3, TrendingUp } from 'lucide-react';
import { getWatchlist, getExpiringSoon, removeFromWatchlist, listPortfolios, createPortfolio, analyzePortfolio, getPortfolio, WatchedPatent, UpcomingFee, Portfolio, BulkAnalysisResult } from '../lib/api';
import PortfolioValuation from './PortfolioValuation';

interface DashboardProps {
  onAnalyzePatent: (patentId: string) => void;
  onBack: () => void;
}

export default function Dashboard({ onAnalyzePatent, onBack }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'watchlist' | 'alerts' | 'portfolios'>('watchlist');
  const [watchlist, setWatchlist] = useState<WatchedPatent[]>([]);
  const [expiringPatents, setExpiringPatents] = useState<WatchedPatent[]>([]);
  const [upcomingFees, setUpcomingFees] = useState<UpcomingFee[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioDesc, setNewPortfolioDesc] = useState('');
  const [selectedPortfolio, setSelectedPortfolio] = useState<string | null>(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<BulkAnalysisResult | null>(null);
  const [analyzingPortfolio, setAnalyzingPortfolio] = useState(false);
  const [valuatingPortfolio, setValuatingPortfolio] = useState<{id: string, name: string, patents: Array<{patent_id: string; patent_title: string; patent_abstract?: string; filing_date?: string; expiration_date?: string; assignee?: string}>} | null>(null);
  const [loadingValuationPatents, setLoadingValuationPatents] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [watchlistRes, alertsRes, portfoliosRes] = await Promise.all([
        getWatchlist(),
        getExpiringSoon(90),
        listPortfolios(),
      ]);
      setWatchlist(watchlistRes.watchlist || []);
      setExpiringPatents(alertsRes.expiring_patents || []);
      setUpcomingFees(alertsRes.upcoming_fees || []);
      setPortfolios(portfoliosRes.portfolios || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromWatchlist = async (patentId: string) => {
    try {
      await removeFromWatchlist(patentId);
      setWatchlist(prev => prev.filter(p => p.patent_id !== patentId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCreatePortfolio = async () => {
    if (!newPortfolioName.trim()) return;
    try {
      await createPortfolio(newPortfolioName, newPortfolioDesc);
      setNewPortfolioName('');
      setNewPortfolioDesc('');
      setShowCreatePortfolio(false);
      const res = await listPortfolios();
      setPortfolios(res.portfolios || []);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAnalyzePortfolio = async (portfolioId: string) => {
    setAnalyzingPortfolio(true);
    setSelectedPortfolio(portfolioId);
    setPortfolioAnalysis(null);
    try {
      const result = await analyzePortfolio(portfolioId) as BulkAnalysisResult;
      setPortfolioAnalysis(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAnalyzingPortfolio(false);
    }
  };

  const handleValueAnalysis = async (portfolio: Portfolio) => {
    setLoadingValuationPatents(portfolio.id);
    try {
      const result = await getPortfolio(portfolio.id) as { portfolio: Portfolio; patents: Array<{patent_id: string; patent_title: string; patent_abstract?: string; filing_date?: string; expiration_date?: string; assignee?: string}> };
      setValuatingPortfolio({
        id: portfolio.id,
        name: portfolio.name,
        patents: result.patents || [],
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingValuationPatents(null);
    }
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

  const getDaysUntil = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const target = parseLocalDate(dateStr);
    const now = new Date();
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getUrgencyColor = (days: number | null) => {
    if (days === null) return 'text-gray-500';
    if (days <= 30) return 'text-red-600';
    if (days <= 90) return 'text-orange-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="text-blue-600 hover:text-blue-700 font-medium mb-2">
            ← Back to Search
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Patent Dashboard</h1>
          <p className="text-gray-600">Monitor your patents and track important deadlines</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">{error}</p>

              {/* Auth hint */}
              {error.toLowerCase().includes('sign in') && (
                <p className="text-sm text-red-600 mt-2">
                  You need to be signed in to access the dashboard. Click <strong>Sign In</strong> in the top right.
                </p>
              )}

              {/* Rate limit hint */}
              {(error.toLowerCase().includes('too many') || error.toLowerCase().includes('rate limit')) && (
                <p className="text-sm text-red-600 mt-2">
                  Please wait 30 seconds before trying again.
                </p>
              )}

              {/* Retry button */}
              <button
                onClick={() => { setError(null); loadData(); }}
                className="inline-flex items-center gap-1.5 text-sm text-red-700 hover:text-red-800 mt-3 font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Eye className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{watchlist.length}</p>
              <p className="text-sm text-gray-600">Watched Patents</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{expiringPatents.length}</p>
              <p className="text-sm text-gray-600">Expiring (90 days)</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{upcomingFees.length}</p>
              <p className="text-sm text-gray-600">Upcoming Fees</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Folder className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{portfolios.length}</p>
              <p className="text-sm text-gray-600">Portfolios</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {[
              { id: 'watchlist', label: 'Watchlist', icon: Eye },
              { id: 'alerts', label: 'Alerts & Deadlines', icon: AlertTriangle },
              { id: 'portfolios', label: 'Portfolios', icon: Folder },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'watchlist' && (
            <div>
              {watchlist.length === 0 ? (
                <div className="text-center py-12">
                  <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No watched patents</h3>
                  <p className="text-gray-600">Analyze a patent and click "Watch Patent" to add it here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {watchlist.map(patent => {
                    const daysUntilExpiry = getDaysUntil(patent.expiration_date);
                    return (
                      <div key={patent.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">{patent.patent_title || 'Untitled Patent'}</h3>
                            <p className="text-sm text-gray-600 font-mono">{patent.patent_id}</p>
                            {patent.assignee && (
                              <p className="text-sm text-gray-500 mt-1">{patent.assignee}</p>
                            )}
                          </div>
                          <div className="text-right">
                            {patent.expiration_date && (
                              <div>
                                <p className={`font-semibold ${getUrgencyColor(daysUntilExpiry)}`}>
                                  {daysUntilExpiry !== null && daysUntilExpiry > 0
                                    ? `${daysUntilExpiry} days left`
                                    : 'Expired'}
                                </p>
                                <p className="text-xs text-gray-500">Expires {formatDate(patent.expiration_date)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <button
                            onClick={() => onAnalyzePatent(patent.patent_id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded hover:bg-blue-100 transition-colors"
                          >
                            <BarChart3 className="w-4 h-4" />
                            Analyze
                          </button>
                          <button
                            onClick={() => handleRemoveFromWatchlist(patent.patent_id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-600" />
                  Expiring Soon (90 days)
                </h3>
                {expiringPatents.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
                    No patents expiring in the next 90 days.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expiringPatents.map(patent => {
                      const days = getDaysUntil(patent.expiration_date);
                      return (
                        <div key={patent.id} className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-lg">
                          <div>
                            <p className="font-semibold text-gray-900">{patent.patent_title || patent.patent_id}</p>
                            <p className="text-sm text-gray-600">Expires {formatDate(patent.expiration_date)}</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${getUrgencyColor(days)}`}>
                              {days} days
                            </p>
                            <button
                              onClick={() => onAnalyzePatent(patent.patent_id)}
                              className="text-sm text-blue-600 hover:text-blue-700"
                            >
                              View details
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                  Upcoming Maintenance Fees (90 days)
                </h3>
                {upcomingFees.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
                    No maintenance fees due in the next 90 days.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingFees.map((fee, idx) => {
                      const days = getDaysUntil(fee.due_date);
                      return (
                        <div key={idx} className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <div>
                            <p className="font-semibold text-gray-900">{fee.patent_title || fee.patent_id}</p>
                            <p className="text-sm text-gray-600">{fee.fee_type} maintenance fee</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${getUrgencyColor(days)}`}>
                              Due in {days} days
                            </p>
                            <p className="text-sm text-gray-500">{formatDate(fee.due_date)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'portfolios' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Your Portfolios</h3>
                <button
                  onClick={() => setShowCreatePortfolio(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FolderPlus className="w-4 h-4" />
                  New Portfolio
                </button>
              </div>

              {showCreatePortfolio && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Create New Portfolio</h4>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Portfolio name"
                      value={newPortfolioName}
                      onChange={e => setNewPortfolioName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <textarea
                      placeholder="Description (optional)"
                      value={newPortfolioDesc}
                      onChange={e => setNewPortfolioDesc(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreatePortfolio}
                        disabled={!newPortfolioName.trim()}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => setShowCreatePortfolio(false)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {portfolios.length === 0 ? (
                <div className="text-center py-12">
                  <Folder className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No portfolios yet</h3>
                  <p className="text-gray-600">Create a portfolio to group and analyze multiple patents together.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {portfolios.map(portfolio => {
                    const patentCount = portfolio.portfolio_patents?.[0]?.count || 0;
                    const isSelected = selectedPortfolio === portfolio.id;
                    return (
                      <div key={portfolio.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h4 className="font-semibold text-gray-900">{portfolio.name}</h4>
                              {portfolio.description && (
                                <p className="text-sm text-gray-600 mt-1">{portfolio.description}</p>
                              )}
                              <p className="text-sm text-gray-500 mt-2">{patentCount} patents</p>
                            </div>
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => handleAnalyzePortfolio(portfolio.id)}
                                disabled={analyzingPortfolio || patentCount === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                              >
                                {analyzingPortfolio && isSelected ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <BarChart3 className="w-4 h-4" />
                                )}
                                Analyze Portfolio
                              </button>
                              <button
                                onClick={() => handleValueAnalysis(portfolio)}
                                disabled={loadingValuationPatents === portfolio.id || patentCount === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                              >
                                {loadingValuationPatents === portfolio.id ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <TrendingUp className="w-4 h-4" />
                                )}
                                Value Analysis
                              </button>
                            </div>
                          </div>
                        </div>

                        {isSelected && portfolioAnalysis && (
                          <div className="border-t border-gray-200 bg-gray-50 p-4">
                            <h5 className="font-semibold text-gray-900 mb-3">Portfolio Analysis</h5>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              <div className="bg-white rounded-lg p-3 border border-gray-200">
                                <p className="text-2xl font-bold text-gray-900">{portfolioAnalysis.summary.successful}</p>
                                <p className="text-xs text-gray-600">Analyzed</p>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-green-200">
                                <p className="text-2xl font-bold text-green-600">{portfolioAnalysis.summary.active_patents}</p>
                                <p className="text-xs text-gray-600">Active</p>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-red-200">
                                <p className="text-2xl font-bold text-red-600">{portfolioAnalysis.summary.expired_patents}</p>
                                <p className="text-xs text-gray-600">Expired</p>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-orange-200">
                                <p className="text-2xl font-bold text-orange-600">{portfolioAnalysis.summary.expiring_soon}</p>
                                <p className="text-xs text-gray-600">Expiring Soon</p>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-gray-200">
                                <p className="text-2xl font-bold text-gray-500">{portfolioAnalysis.summary.failed}</p>
                                <p className="text-xs text-gray-600">Failed</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {valuatingPortfolio && (
        <PortfolioValuation
          portfolioId={valuatingPortfolio.id}
          portfolioName={valuatingPortfolio.name}
          patents={valuatingPortfolio.patents}
          onClose={() => setValuatingPortfolio(null)}
        />
      )}
    </div>
  );
}
