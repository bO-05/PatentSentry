import { useState, useEffect, useCallback, useRef } from 'react';
import { Scale, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Filter, Search, Clock, ArrowUpCircle, LayoutDashboard, Download, RefreshCw, X, Keyboard, Github, Twitter, Map } from 'lucide-react';
import SearchBar, { SearchBarHandle } from './components/SearchBar';
import PatentCard from './components/PatentCard';
import PatentTimeline from './components/PatentTimeline';
import LandingPage from './components/LandingPage';
import FilingTrendsChart from './components/FilingTrendsChart';
import Dashboard from './components/Dashboard';
import PatentComparison from './components/PatentComparison';
import QuickLookupModal from './components/QuickLookupModal';
import PatentLandscape from './components/PatentLandscape';
import AuthModal from './components/AuthModal';
import UserMenu from './components/UserMenu';
import { PatentCardSkeletonList, AnalysisSkeleton } from './components/Skeleton';
import { useToast } from './components/Toast';
import { useDebounce } from './hooks/useDebounce';
import { searchPatents, analyzePatent, addToWatchlist, listPortfolios, addToPortfolio, Portfolio, waitForPrefetch, getPrefetchedAnalysis } from './lib/api';
import { PatentSearchResult } from './types/patent';
import { saveSearchHistory, getSearchHistory, deleteSearchHistoryEntry, SearchHistoryEntry } from './lib/supabase';
import { useAuth, saveSessionState, getStoredSessionState } from './lib/auth';

interface SearchResponse {
  query: string;
  results: PatentSearchResult[];
  total_count: number;
  page: number;
  per_page: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  source: string;
}

type ViewState = 'landing' | 'search' | 'results' | 'analysis' | 'dashboard';
type SortType = 'relevance' | 'date_desc' | 'date_asc';
type DateFilter = 'all' | '5years' | '10years' | '20years';

function App() {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [loading, setLoading] = useState(false);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [analysisData, setAnalysisData] = useState<Record<string, unknown> | null>(null);
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortBy, setSortBy] = useState<SortType>('relevance');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [searchWithinResults, setSearchWithinResults] = useState<string>('');
  const [recentSearches, setRecentSearches] = useState<SearchHistoryEntry[]>([]);
  const [directPatentId, setDirectPatentId] = useState<string>('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [currentAnalysisPatentId, setCurrentAnalysisPatentId] = useState<string | null>(null);
  const [selectedPatents, setSelectedPatents] = useState<Record<string, unknown>[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState<number>(-1);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showQuickLookup, setShowQuickLookup] = useState(false);
  const [showLandscape, setShowLandscape] = useState(false);

  const { user } = useAuth();
  const { addToast, updateToast } = useToast();
  const debouncedSearchFilter = useDebounce(searchWithinResults, 150);
  const searchStartTime = useRef<number>(0);
  const searchBarRef = useRef<SearchBarHandle>(null);
  const searchRequestIdRef = useRef<number>(0);
  const analysisRequestIdRef = useRef<number>(0);

  useEffect(() => {
    loadRecentSearches();
    if (user) {
      loadPortfolios();
    }
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [user]);

  useEffect(() => {
    if (viewState !== 'landing' && viewState !== 'dashboard') {
      saveSessionState({
        viewState,
        currentQuery,
        currentPage,
        sortBy,
        dateFilter,
      });
    }
  }, [viewState, currentQuery, currentPage, sortBy, dateFilter]);

  const getFilteredResults = useCallback((results: PatentSearchResult[]): PatentSearchResult[] => {
    let filtered = results;

    if (dateFilter !== 'all') {
      const now = new Date();
      const years = dateFilter === '5years' ? 5 : dateFilter === '10years' ? 10 : 20;
      const cutoff = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
      filtered = filtered.filter(p => {
        const dateStr = p.patent_date;
        if (!dateStr) return true;
        return new Date(dateStr) >= cutoff;
      });
    }

    if (debouncedSearchFilter) {
      const search = debouncedSearchFilter.toLowerCase();
      filtered = filtered.filter(p => {
        const title = (p.patent_title || '').toLowerCase();
        const abstract = (p.patent_abstract || '').toLowerCase();
        const assignee = p.assignees?.[0]?.assignee_organization?.toLowerCase() || '';
        return title.includes(search) || abstract.includes(search) || assignee.includes(search);
      });
    }

    return filtered;
  }, [dateFilter, debouncedSearchFilter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === 'Escape') {
        if (showQuickLookup) {
          setShowQuickLookup(false);
          return;
        }
        if (showAuthModal) {
          setShowAuthModal(false);
          return;
        }
        if (showKeyboardHelp) {
          setShowKeyboardHelp(false);
          return;
        }
        if (viewState === 'analysis') {
          handleBackToResults();
        } else if (viewState === 'results') {
          handleBackToSearch();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Open quick lookup modal instead of just focusing search
        setShowQuickLookup(true);
      }

      if (e.key === '/' && !isInputFocused && (viewState === 'search' || viewState === 'results')) {
        e.preventDefault();
        searchBarRef.current?.focus();
      }

      if (e.key === '?' && !isInputFocused) {
        e.preventDefault();
        setShowKeyboardHelp(prev => !prev);
      }

      if (viewState === 'results' && searchData && !isInputFocused) {
        const results = getFilteredResults(searchData.results);

        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveResultIndex(prev => Math.min(prev + 1, results.length - 1));
        }

        if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveResultIndex(prev => Math.max(prev - 1, 0));
        }

        if (e.key === 'Enter' && activeResultIndex >= 0 && activeResultIndex < results.length) {
          e.preventDefault();
          const patent = results[activeResultIndex];
          handleAnalyze(patent.patent_id as string);
        }

        if (e.key === 'x' && activeResultIndex >= 0 && activeResultIndex < results.length) {
          e.preventDefault();
          const patent = results[activeResultIndex];
          handleTogglePatentSelection(patent as unknown as Record<string, unknown>);
        }

        if (e.key === 'g' && !e.shiftKey) {
          e.preventDefault();
          setActiveResultIndex(0);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        if (e.key === 'G' || (e.key === 'g' && e.shiftKey)) {
          e.preventDefault();
          setActiveResultIndex(results.length - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewState, searchData, activeResultIndex, showAuthModal, showKeyboardHelp, showQuickLookup, getFilteredResults]);

  const loadRecentSearches = async () => {
    const searches = await getSearchHistory(5);
    setRecentSearches(searches);
  };

  const handleDeleteSearchEntry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await deleteSearchHistoryEntry(id);
    if (success) {
      setRecentSearches(prev => prev.filter(s => s.id !== id));
    }
  };

  const loadPortfolios = async () => {
    if (!user) {
      setPortfolios([]);
      return;
    }
    try {
      const res = await listPortfolios();
      setPortfolios(res.portfolios || []);
    } catch {
      setPortfolios([]);
    }
  };

  const handleSearch = useCallback(async (query: string, page: number = 1, sort: SortType = 'relevance') => {
    const currentRequestId = ++searchRequestIdRef.current;
    setLoading(true);
    setSearchError(null);
    setSearchTime(null);
    setCurrentQuery(query);
    setCurrentPage(page);
    setSortBy(sort);
    setViewState('results');
    setActiveResultIndex(-1);
    searchStartTime.current = performance.now();

    try {
      const data = await searchPatents(query, page, sort) as SearchResponse;

      if (currentRequestId !== searchRequestIdRef.current) return;

      const elapsed = Math.round(performance.now() - searchStartTime.current);
      setSearchTime(elapsed);

      if ((data as unknown as { error?: string }).error) {
        setSearchError((data as unknown as { error?: string }).error as string);
        setSearchData(null);
        return;
      }

      setSearchData(data);
      if (page === 1) {
        await saveSearchHistory(query);
        if (currentRequestId === searchRequestIdRef.current) {
          loadRecentSearches();
        }
      }
    } catch (err) {
      if (currentRequestId !== searchRequestIdRef.current) return;
      setSearchError((err as Error).message || 'Search failed. Please try again.');
      setSearchData(null);
    } finally {
      if (currentRequestId === searchRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const stored = getStoredSessionState();
    if (stored?.viewState === 'results' && stored.currentQuery) {
      setCurrentQuery(stored.currentQuery);
      setSortBy((stored.sortBy as SortType) || 'relevance');
      setDateFilter((stored.dateFilter as DateFilter) || 'all');
      setViewState('results');
      handleSearch(stored.currentQuery, stored.currentPage || 1, (stored.sortBy as SortType) || 'relevance');
    }
  }, [handleSearch]);

  const handleNextPage = () => {
    if (searchData?.has_next) {
      handleSearch(currentQuery, currentPage + 1, sortBy);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPage = () => {
    if (searchData?.has_prev) {
      handleSearch(currentQuery, currentPage - 1, sortBy);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSortChange = (newSort: SortType) => {
    if (newSort !== sortBy) {
      handleSearch(currentQuery, 1, newSort);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAnalyze = useCallback(async (patentId: string) => {
    const currentRequestId = ++analysisRequestIdRef.current;
    setAnalysisData(null);
    setAnalysisError(null);
    setIsWatchlisted(false);
    setCurrentAnalysisPatentId(patentId);
    setViewState('analysis');

    const prefetched = getPrefetchedAnalysis(patentId) as Record<string, unknown> | null;
    if (prefetched && !prefetched.error) {
      if (currentRequestId !== analysisRequestIdRef.current) return;
      setAnalysisData(prefetched);
      setLoading(false);
      await saveSearchHistory(searchData?.query || 'Direct analysis', patentId);
      return;
    }

    setLoading(true);

    const pendingData = await waitForPrefetch(patentId) as Record<string, unknown> | null;
    if (pendingData && !pendingData.error) {
      if (currentRequestId !== analysisRequestIdRef.current) return;
      setAnalysisData(pendingData);
      setLoading(false);
      await saveSearchHistory(searchData?.query || 'Direct analysis', patentId);
      return;
    }

    try {
      const data = await analyzePatent(patentId) as Record<string, unknown>;

      if (currentRequestId !== analysisRequestIdRef.current) return;

      if (data.error) {
        setAnalysisError(data.error as string);
        setLoading(false);
        return;
      }

      setAnalysisData(data);
      await saveSearchHistory(searchData?.query || 'Direct analysis', patentId);
    } catch (err) {
      if (currentRequestId !== analysisRequestIdRef.current) return;
      const errorMessage = (err as Error).message || 'Analysis failed. Please try again.';
      setAnalysisError(errorMessage);
    } finally {
      if (currentRequestId === analysisRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [searchData]);

  const handleAddToWatchlist = async () => {
    if (!analysisData) return;

    setIsWatchlisted(true);
    const toastId = addToast('Adding to watchlist...', 'loading');

    try {
      await addToWatchlist(analysisData.patent_id as string, analysisData);
      updateToast(toastId, 'Patent added to watchlist', 'success');
    } catch (err) {
      setIsWatchlisted(false);
      const message = err instanceof Error ? err.message : 'Failed to add to watchlist';
      // If auth error, show sign in prompt
      if (message.toLowerCase().includes('sign in')) {
        updateToast(toastId, 'Sign in to add patents to your watchlist', 'error');
        setShowAuthModal(true);
      } else {
        updateToast(toastId, message, 'error');
      }
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    if (!analysisData) return;

    const dates = analysisData.dates as Record<string, unknown>;
    const maintenanceFees = analysisData.maintenance_fees as Record<string, Record<string, string>> | undefined;

    // For JSON: export full data object
    // For CSV: export flattened key fields
    const csvData = {
      patent_id: analysisData.patent_id,
      title: analysisData.title,
      abstract: (analysisData.abstract as string || '').substring(0, 500),
      filing_date: dates?.filed,
      grant_date: dates?.granted,
      expiration_date: dates?.calculated_expiry,
      pta_days: dates?.pta_days || 0,
      pte_days: dates?.pte_days || 0,
      is_active: analysisData.is_active,
      fee_3_5_year_due: maintenanceFees?.year_3_5?.due_date || '',
      fee_7_5_year_due: maintenanceFees?.year_7_5?.due_date || '',
      fee_11_5_year_due: maintenanceFees?.year_11_5?.due_date || '',
      source: analysisData.source,
      exported_at: new Date().toISOString(),
    };

    const jsonData = {
      ...analysisData,
      exported_at: new Date().toISOString(),
    };

    if (format === 'csv') {
      const headers = Object.keys(csvData).join(',');
      const values = Object.values(csvData).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
      const csvContent = `${headers}\n${values}`;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patent-${analysisData.patent_id}-analysis.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patent-${analysisData.patent_id}-analysis.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    addToast(`Exported as ${format.toUpperCase()}`, 'success', 2000);
  };

  const handleAddToPortfolio = async (portfolioId: string) => {
    if (!analysisData) return;

    const toastId = addToast('Adding to portfolio...', 'loading');

    try {
      await addToPortfolio(portfolioId, analysisData.patent_id as string, analysisData.title as string);
      updateToast(toastId, 'Patent added to portfolio', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add to portfolio';
      // If auth error, show sign in prompt
      if (message.toLowerCase().includes('sign in')) {
        updateToast(toastId, 'Sign in to add patents to portfolios', 'error');
        setShowAuthModal(true);
      } else {
        updateToast(toastId, message, 'error');
      }
    }
  };

  const handleExportSearchResults = () => {
    if (!searchData?.results?.length) return;

    const results = getFilteredResults(searchData.results);
    const csvRows = [
      ['Patent ID', 'Title', 'Grant Date', 'Assignee', 'Status', 'Abstract'].join(',')
    ];

    results.forEach(patent => {
      const isActive = new Date() < new Date(new Date(patent.patent_date as string).getTime() + 20 * 365.25 * 24 * 60 * 60 * 1000);
      const assignee = (patent.assignees as Array<{ assignee_organization: string }>)?.[0]?.assignee_organization || '';
      const patentId = String(patent.patent_id).toUpperCase();
      const normalizedPatentId = patentId.startsWith('US') ? patentId : `US${patentId}`;
      const row = [
        normalizedPatentId,
        `"${String(patent.patent_title || '').replace(/"/g, '""')}"`,
        patent.patent_date,
        `"${assignee.replace(/"/g, '""')}"`,
        isActive ? 'Likely Active' : 'Likely Expired',
        `"${String(patent.patent_abstract || '').substring(0, 200).replace(/"/g, '""')}..."`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patent-search-${currentQuery.replace(/\s+/g, '-').substring(0, 30)}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast(`Exported ${results.length} patents to CSV`, 'success', 2000);
  };

  const handleRetrySearch = () => {
    if (currentQuery) {
      handleSearch(currentQuery, currentPage, sortBy);
    }
  };

  const handleBackToSearch = () => {
    setViewState('search');
    setSearchData(null);
    setAnalysisData(null);
    setCurrentQuery('');
    setCurrentPage(1);
    setSortBy('relevance');
    setDateFilter('all');
    setSearchWithinResults('');
    setSelectedPatents([]);
    setShowComparison(false);
  };

  const handleTogglePatentSelection = (patent: Record<string, unknown>) => {
    setSelectedPatents(prev => {
      const exists = prev.some(p => p.patent_id === patent.patent_id);
      if (exists) {
        return prev.filter(p => p.patent_id !== patent.patent_id);
      }
      if (prev.length >= 10) {
        return prev;
      }
      return [...prev, patent];
    });
  };

  const handleRemoveFromComparison = (patentId: string) => {
    setSelectedPatents(prev => prev.filter(p => p.patent_id !== patentId));
  };

  const handleBackToResults = () => {
    setViewState('results');
    setAnalysisData(null);
  };

  const handleDirectAnalyze = async () => {
    if (!directPatentId.trim()) return;
    await handleAnalyze(directPatentId.trim());
    setDirectPatentId('');
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEnterApp = () => {
    setViewState('search');
  };

  if (viewState === 'landing') {
    return <LandingPage onEnterApp={handleEnterApp} onSearch={handleSearch} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setViewState('search')}>
              <Scale className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PatentSentry</h1>
                <p className="text-sm text-gray-600">🇺🇸 US Patents Only • USPTO PatentsView</p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => setShowKeyboardHelp(true)}
                className="hidden md:flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard className="w-4 h-4" />
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">?</kbd>
              </button>
              <button
                onClick={() => {
                  if (!user) {
                    setShowAuthModal(true);
                    addToast('Sign in to access your dashboard', 'info');
                    return;
                  }
                  setViewState('dashboard');
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewState === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
              <UserMenu onSignInClick={() => setShowAuthModal(true)} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {viewState === 'dashboard' && (
          <Dashboard
            onAnalyzePatent={handleAnalyze}
            onBack={() => setViewState('search')}
          />
        )}

        {viewState === 'search' && (
          <div className="text-center animate-fade-in">
            <div className="mb-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Know the Exact Day a Patent Dies
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Real USPTO data with maintenance fee tracking, expiration alerts, and portfolio management.
              </p>
            </div>

            <div className="flex justify-center mb-8">
              <SearchBar ref={searchBarRef} onSearch={handleSearch} loading={loading} autoFocus />
            </div>

            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-blue-600" />
                  Quick Analyze Patent
                </h3>
                <p className="text-sm text-gray-600 mb-3">Enter a US patent number to analyze</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., 8977571 or US8977571"
                    value={directPatentId}
                    onChange={(e) => setDirectPatentId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleDirectAnalyze()}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  />
                  <button
                    onClick={handleDirectAnalyze}
                    disabled={!directPatentId.trim() || loading}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Analyze
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5 text-blue-600" />
                  Patent Dashboard
                </h3>
                <p className="text-sm text-gray-600 mb-3">Monitor patents, track deadlines, manage portfolios</p>
                <button
                  onClick={() => setViewState('dashboard')}
                  className="w-full px-4 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Open Dashboard
                </button>
              </div>
            </div>

            {recentSearches.length > 0 && (
              <div className="bg-white rounded-xl p-6 max-w-2xl mx-auto border border-gray-200 shadow-sm mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-600" />
                  Recent Searches
                </h3>
                <div className="space-y-2">
                  {recentSearches.map((search) => (
                    <div
                      key={search.id}
                      className="group flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <button
                        onClick={() => handleSearch(search.query)}
                        className="flex-1 text-left text-sm text-gray-700"
                      >
                        {search.query}
                      </button>
                      <button
                        onClick={(e) => handleDeleteSearchEntry(search.id!, e)}
                        className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove from history"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl p-6 max-w-3xl mx-auto border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                What Makes This Different
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">USPTO Data</h4>
                  <p className="text-sm text-blue-800">Direct from PatentsView API with accurate filing and grant dates</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg">
                  <h4 className="font-semibold text-amber-900 mb-2">Fee Deadlines</h4>
                  <p className="text-sm text-amber-800">Track 3.5, 7.5, and 11.5 year maintenance fee windows</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">Watchlist</h4>
                  <p className="text-sm text-green-800">Monitor patents and get alerts for expiring patents</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewState === 'results' && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <button
                onClick={handleBackToSearch}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                New Search
              </button>
            </div>

            <div className="bg-white rounded-xl p-6 mb-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">Search Results</h2>
                  <p className="text-gray-600">
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        Searching for "{currentQuery}"...
                      </span>
                    ) : searchError ? (
                      <span className="text-red-600">Search failed</span>
                    ) : searchData ? (
                      <>
                        Found {searchData.total_count.toLocaleString()} patents for "{searchData.query}"
                        <span className="text-sm text-gray-500 ml-2">via {searchData.source}</span>
                        {searchTime && (
                          <span className="text-sm text-gray-400 ml-2">({(searchTime / 1000).toFixed(2)}s)</span>
                        )}
                      </>
                    ) : (
                      `Searching for "${currentQuery}"...`
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {searchData && searchData.results.length >= 5 && (
                    <button
                      onClick={() => setShowLandscape(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
                    >
                      <Map className="w-4 h-4" />
                      Landscape Analysis
                    </button>
                  )}
                  {searchData && searchData.results.length > 0 && (
                    <button
                      onClick={handleExportSearchResults}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
                      title="Export visible results to CSV"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Export</span>
                    </button>
                  )}
                </div>
              </div>

              {searchError && !loading && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-red-800 font-medium">{searchError}</p>

                      {/* Auth hint */}
                      {searchError.toLowerCase().includes('sign in') && (
                        <p className="text-sm text-red-600 mt-2">
                          You need to be signed in for this feature.
                        </p>
                      )}

                      {/* Rate limit hint */}
                      {(searchError.toLowerCase().includes('too many') || searchError.toLowerCase().includes('rate limit')) && (
                        <p className="text-sm text-amber-600 mt-2">
                          Please wait 30 seconds before trying again.
                        </p>
                      )}
                    </div>

                    {/* Show Sign In button for auth errors, Retry for others */}
                    {searchError.toLowerCase().includes('sign in') ? (
                      <button
                        onClick={() => setShowAuthModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                      >
                        Sign In
                      </button>
                    ) : (
                      <button
                        onClick={handleRetrySearch}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4" />
                    Sort:
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSortChange('relevance')}
                      disabled={loading}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sortBy === 'relevance'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      Relevance
                    </button>
                    <button
                      onClick={() => handleSortChange(sortBy === 'date_desc' ? 'date_asc' : 'date_desc')}
                      disabled={loading}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sortBy === 'date_desc' || sortBy === 'date_asc'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      Date {sortBy === 'date_asc' ? '(Oldest)' : '(Newest)'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filter:
                  </span>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  >
                    <option value="all">All time</option>
                    <option value="5years">Last 5 years</option>
                    <option value="10years">Last 10 years</option>
                    <option value="20years">Last 20 years</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filter results by title, abstract, or assignee..."
                    value={searchWithinResults}
                    onChange={(e) => setSearchWithinResults(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  />
                  {searchWithinResults && (
                    <button
                      onClick={() => setSearchWithinResults('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

              {searchData && !searchError && (
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>
                    Showing {getFilteredResults(searchData.results).length}
                    {(dateFilter !== 'all' || searchWithinResults) && ` (filtered from ${searchData.results.length})`} of {searchData.total_count.toLocaleString()} total
                  </span>
                  <span>
                    Page {searchData.page} of {searchData.total_pages}
                  </span>
                </div>
              )}

              {selectedPatents.length > 0 && (
                <div className="mt-4 flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-sm text-blue-800">
                    {selectedPatents.length} patent{selectedPatents.length > 1 ? 's' : ''} selected
                    {selectedPatents.length < 10 && ' (select up to 10)'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedPatents([])}
                      className="px-3 py-1.5 text-sm text-blue-700 hover:text-blue-800 font-medium"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowComparison(true)}
                      disabled={selectedPatents.length < 2}
                      className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${selectedPatents.length >= 2
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-blue-200 text-blue-400 cursor-not-allowed'
                        }`}
                    >
                      Compare
                    </button>
                  </div>
                </div>
              )}
            </div>

            {loading ? (
              <PatentCardSkeletonList count={5} />
            ) : searchData ? (
              <>
                <FilingTrendsChart patents={searchData.results} />

                <div className="space-y-4">
                  {getFilteredResults(searchData.results).map((patent, index) => (
                    <PatentCard
                      key={`${patent.patent_id}-${index}`}
                      patent={patent}
                      onAnalyze={(patentId) => handleAnalyze(patentId)}
                      showSelection={true}
                      isSelected={selectedPatents.some(p => p.patent_id === patent.patent_id)}
                      onToggleSelect={handleTogglePatentSelection}
                      isActive={activeResultIndex === index}
                    />
                  ))}
                </div>

                {getFilteredResults(searchData.results).length === 0 && (
                  <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">
                      {searchWithinResults
                        ? 'No patents match your filter.'
                        : dateFilter === 'all'
                          ? 'No US patents found. Try a different search term.'
                          : 'No US patents found in this date range.'}
                    </p>
                    <p className="text-amber-600 text-sm mb-3">
                      🇺🇸 Note: This app only searches US patents (USPTO). For international patents, try Google Patents.
                    </p>
                    {searchWithinResults && (
                      <button
                        onClick={() => setSearchWithinResults('')}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                )}

                {searchData.results.length > 0 && (searchData.has_prev || searchData.has_next) && (
                  <div className="mt-8 flex items-center justify-center gap-4">
                    <button
                      onClick={handlePrevPage}
                      disabled={!searchData.has_prev || loading}
                      className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${searchData.has_prev && !loading
                        ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Previous
                    </button>
                    <div className="text-gray-700 font-medium px-4">
                      Page {searchData.page} of {searchData.total_pages}
                    </div>
                    <button
                      onClick={handleNextPage}
                      disabled={!searchData.has_next || loading}
                      className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${searchData.has_next && !loading
                        ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                      Next
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {viewState === 'analysis' && (
          <div className="animate-fade-in">
            <div className="mb-6 flex gap-4">
              <button
                onClick={handleBackToResults}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Results
              </button>
              <button
                onClick={handleBackToSearch}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                New Search
              </button>
              <span className="text-gray-400 text-sm ml-auto hidden md:inline">
                Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-xs">Esc</kbd> to go back
              </span>
            </div>

            {loading ? (
              <AnalysisSkeleton />
            ) : analysisError ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Analysis Failed</h2>
                <p className="text-gray-600 mb-4 max-w-md mx-auto">{analysisError}</p>

                {/* Auth hint */}
                {analysisError.toLowerCase().includes('sign in') && (
                  <p className="text-sm text-red-600 mb-4">
                    You need to be signed in for this feature.
                  </p>
                )}

                {/* Rate limit hint */}
                {(analysisError.toLowerCase().includes('too many') || analysisError.toLowerCase().includes('rate limit')) && (
                  <p className="text-sm text-amber-600 mb-4">
                    Please wait 30 seconds before trying again.
                  </p>
                )}

                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => {
                      setAnalysisError(null);
                      handleBackToResults();
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Back to Results
                  </button>

                  {/* Show Sign In button for auth errors */}
                  {analysisError.toLowerCase().includes('sign in') ? (
                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Sign In
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setAnalysisError(null);
                        if (currentAnalysisPatentId) {
                          handleAnalyze(currentAnalysisPatentId);
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry
                    </button>
                  )}
                </div>
              </div>
            ) : analysisData ? (
              <PatentTimeline
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                analysis={analysisData as any}
                onAddToWatchlist={handleAddToWatchlist}
                onExport={handleExport}
                portfolios={portfolios}
                onAddToPortfolio={handleAddToPortfolio}
                isWatchlisted={isWatchlisted}
              />
            ) : null}
          </div>
        )}
      </main>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-110 active:scale-95"
          title="Scroll to top"
        >
          <ArrowUpCircle className="w-6 h-6" />
        </button>
      )}

      {showComparison && selectedPatents.length >= 1 && (
        <PatentComparison
          patents={selectedPatents as Array<{
            patent_id: string;
            patent_title: string;
            patent_abstract: string;
            patent_date: string;
            filing_date?: string;
            expiration_date?: string;
            is_active?: boolean;
            assignees?: Array<{ assignee_organization: string }>;
          }>}
          onClose={() => setShowComparison(false)}
          onRemove={handleRemoveFromComparison}
          onClearAll={() => {
            setSelectedPatents([]);
            setShowComparison(false);
          }}
          onAnalyze={handleAnalyze}
        />
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          loadRecentSearches();
          loadPortfolios();
        }}
      />

      {showKeyboardHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowKeyboardHelp(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Navigation</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Focus search</span><kbd className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">/</kbd></div>
                  <div className="flex justify-between"><span className="text-gray-600">Quick search</span><kbd className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">⌘K</kbd></div>
                  <div className="flex justify-between"><span className="text-gray-600">Go back</span><kbd className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">Esc</kbd></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Results List</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Move down</span><kbd className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">j / ↓</kbd></div>
                  <div className="flex justify-between"><span className="text-gray-600">Move up</span><kbd className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">k / ↑</kbd></div>
                  <div className="flex justify-between"><span className="text-gray-600">Open patent</span><kbd className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">Enter</kbd></div>
                  <div className="flex justify-between"><span className="text-gray-600">Toggle select</span><kbd className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">x</kbd></div>
                  <div className="flex justify-between"><span className="text-gray-600">Jump to top</span><kbd className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">g</kbd></div>
                  <div className="flex justify-between"><span className="text-gray-600">Jump to bottom</span><kbd className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">G</kbd></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Other</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Toggle this help</span><kbd className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">?</kbd></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Lookup Modal (Ctrl+K) */}
      <QuickLookupModal
        isOpen={showQuickLookup}
        onClose={() => setShowQuickLookup(false)}
        onAnalyze={handleAnalyze}
      />

      {showLandscape && searchData && (
        <PatentLandscape
          query={currentQuery}
          patents={searchData.results.map(p => ({
            patent_id: p.patent_id,
            patent_title: p.patent_title,
            patent_abstract: p.patent_abstract || '',
            assignee: p.assignees?.[0]?.assignee_organization,
            filing_date: p.patent_date,
          }))}
          onClose={() => setShowLandscape(false)}
        />
      )}

      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <p className="text-sm text-amber-700 text-center mb-2 font-medium">
            🇺🇸 US Patents Only — Data from USPTO PatentsView API
          </p>
          <p className="text-xs text-gray-500 text-center mb-3">
            For international patents (EPO, WIPO, JPO, etc.), use Google Patents
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
            <span>Built by <a href="https://github.com/bO-05" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"><Github className="w-4 h-4" /> asynchronope</a></span>
            <span className="text-gray-300">·</span>
            <a href="https://x.com/asynchronope" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"><Twitter className="w-4 h-4" /> @asynchronope</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
