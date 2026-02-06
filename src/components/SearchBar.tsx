import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Search, X, Loader2, Sparkles } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading?: boolean;
  isLoading?: boolean;
  autoFocus?: boolean;
  aiEnhanced?: boolean;
  minCharacters?: number;
  debounceMs?: number;
}

export interface SearchBarHandle {
  focus: () => void;
  clear: () => void;
}

const SearchBar = forwardRef<SearchBarHandle, SearchBarProps>(({
  onSearch,
  loading,
  isLoading,
  autoFocus,
  aiEnhanced = false,
  minCharacters = 3,
  debounceMs = 0
}, ref) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSearching = loading || isLoading;

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
    clear: () => {
      setQuery('');
      inputRef.current?.focus();
    },
  }));

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);

    if (debounceMs > 0 && value.trim().length >= minCharacters) {
      setIsDebouncing(true);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        setIsDebouncing(false);
      }, debounceMs);
    } else {
      setIsDebouncing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= minCharacters) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      setIsDebouncing(false);
      onSearch(query.trim());
    }
  };

  const isTooShort = query.trim().length > 0 && query.trim().length < minCharacters;

  const handleClear = () => {
    setQuery('');
    setIsDebouncing(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl" role="search">
      <label htmlFor="patent-search" className="sr-only">
        Search patents by technology description
      </label>
      <div className="relative">
        {aiEnhanced && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-purple-500">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span className="text-xs font-medium hidden sm:inline">AI-enhanced</span>
          </div>
        )}
        <input
          ref={inputRef}
          id="patent-search"
          name="search"
          type="text"
          autoComplete="off"
          spellCheck="false"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search by keyword, inventor, assignee, or patent number..."
          aria-label="Search patents"
          aria-describedby={isTooShort ? "char-hint" : (!isFocused && !query ? "search-hint" : undefined)}
          aria-invalid={isTooShort}
          className={`w-full py-4 pr-28 text-lg border-2 rounded-xl transition-all ${aiEnhanced ? 'pl-28 sm:pl-32' : 'px-5'
            } ${isTooShort
              ? 'border-amber-400 shadow-sm shadow-amber-50'
              : isFocused
                ? 'border-blue-500 shadow-sm shadow-blue-100'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          disabled={isSearching}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isSearching && (
            <div className="p-2">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" aria-hidden="true" />
            </div>
          )}
          {isDebouncing && !isSearching && (
            <div className="p-2 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-xs text-gray-400">typing...</span>
            </div>
          )}
          {query && !isSearching && !isDebouncing && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
          <button
            type="submit"
            disabled={isSearching || isTooShort || !query.trim()}
            className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            aria-label={isSearching ? 'Searching...' : 'Search patents'}
          >
            <Search className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        {!isFocused && !query && (
          <div
            id="search-hint"
            className="absolute right-20 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1.5 text-xs text-gray-400 pointer-events-none select-none"
          >
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono text-xs">/</kbd>
            <span>to focus</span>
          </div>
        )}
        {isTooShort && (
          <div
            id="char-hint"
            className="absolute left-5 -bottom-6 text-xs text-amber-600"
            role="status"
          >
            Enter at least {minCharacters} characters to search
          </div>
        )}
      </div>
    </form>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;
