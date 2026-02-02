import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading?: boolean;
  autoFocus?: boolean;
}

export interface SearchBarHandle {
  focus: () => void;
  clear: () => void;
}

const SearchBar = forwardRef<SearchBarHandle, SearchBarProps>(({ onSearch, loading, autoFocus }, ref) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl" role="search">
      <label htmlFor="patent-search" className="sr-only">
        Search patents by technology description
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id="patent-search"
          name="search"
          type="text"
          autoComplete="off"
          spellCheck="false"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Describe the technology..."
          aria-label="Search patents"
          aria-describedby={!isFocused && !query ? "search-hint" : undefined}
          className={`w-full px-5 py-4 pr-24 text-lg border-2 rounded-xl transition-shadow ${
            isFocused
              ? 'border-blue-500 shadow-sm shadow-blue-100'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          disabled={loading}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            aria-label={loading ? 'Searching...' : 'Search patents'}
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
      </div>
    </form>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;
