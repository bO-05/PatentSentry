import { useEffect, useRef } from 'react';
import { Scale, ArrowRight, GitBranch, Brain, Search, Github, Twitter, Command } from 'lucide-react';

interface LandingPageProps {
  onEnterApp: () => void;
  onSearch?: (query: string) => void;
}

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200">
      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

const exampleQueries = ['machine learning', 'autonomous vehicles', 'CRISPR gene editing'];

export default function LandingPage({ onEnterApp, onSearch }: LandingPageProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts to focus the search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl+K or Cmd+K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      // "/" to focus search (when not already in an input)
      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleExampleSearch = (query: string) => {
    if (onSearch) {
      onSearch(query);
    } else {
      onEnterApp();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 overflow-hidden">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(37, 99, 235, 0.06) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(37, 99, 235, 0.03) 0%, transparent 70%)
          `,
        }}
      />

      <section className="relative min-h-screen flex items-center justify-center px-6 py-12">
        <div className="max-w-5xl mx-auto text-center z-10">
          <div className="mb-8 animate-fade-in">
            <div className="inline-flex items-center gap-3 mb-6 px-5 py-2.5 bg-white/80 backdrop-blur-sm rounded-full border border-blue-100 shadow-sm">
              <Scale className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">PatentSentry</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight mb-6 tracking-tight">
              Patent Intelligence
              <br />
              <span className="text-blue-600">Powered by AI</span>
            </h1>
          </div>

          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-6 leading-relaxed">
            Get exact expiration dates, claims analysis, and FTO insights that Google Patents doesn't offer.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full mb-8">
            <span className="text-amber-700 font-semibold text-sm">🇺🇸 US Patents Only</span>
            <span className="text-amber-600 text-sm">• Data from USPTO PatentsView API</span>
          </div>

          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by keyword, inventor, assignee, or patent number..."
                className="w-full pl-12 pr-4 py-4 text-lg bg-white border border-gray-200 rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    handleExampleSearch(e.currentTarget.value);
                  }
                }}
              />
              <button
                onClick={onEnterApp}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Search
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-500">
              <Command className="w-4 h-4" />
              <span>Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">/</kbd> or <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Ctrl+K</kbd> to focus search</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-10">
            <span className="text-sm text-gray-500 mr-2">Try:</span>
            {exampleQueries.map((q) => (
              <button
                key={q}
                onClick={() => handleExampleSearch(q)}
                className="px-4 py-1.5 bg-gray-100 rounded-full text-sm text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <button
              onClick={onEnterApp}
              className="group px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              Start Searching
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#features"
              className="px-8 py-4 bg-white text-gray-700 text-base font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm border border-gray-200"
            >
              Learn More
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <FeatureCard
              icon={Brain}
              title="AI Analysis"
              description="3-step Gemini pipeline for claims, scope, and FTO"
            />
            <FeatureCard
              icon={GitBranch}
              title="Claim Graphs"
              description="Visual claim dependency visualization"
            />
            <FeatureCard
              icon={Search}
              title="Prior Art Agent"
              description="Autonomous discovery of relevant patents"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
            <span className="font-medium">Powered by:</span>
            <span className="px-3 py-1 bg-white/80 rounded-full border border-gray-200">USPTO PatentsView</span>
            <span className="text-gray-300">•</span>
            <span className="px-3 py-1 bg-white/80 rounded-full border border-gray-200">Google Gemini 3</span>
            <span className="text-gray-300">•</span>
            <span className="px-3 py-1 bg-white/80 rounded-full border border-gray-200">Exa AI</span>
          </div>
        </div>
      </section>

      <section id="features" className="relative py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-blue-600 rounded-2xl p-12 shadow-xl">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to get started?
            </h2>
            <p className="text-blue-100 mb-8 max-w-xl mx-auto">
              Join researchers, attorneys, and innovators who trust PatentSentry for accurate patent analysis.
            </p>
            <button
              onClick={onEnterApp}
              className="group px-8 py-4 bg-white text-blue-600 text-base font-semibold rounded-xl hover:bg-blue-50 transition-all duration-200 shadow-lg inline-flex items-center gap-2"
            >
              Launch PatentSentry
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500 mb-4">
            <span className="font-medium">Powered by:</span>
            <span>USPTO PatentsView</span>
            <span className="text-gray-300">•</span>
            <span>Google Gemini 3</span>
            <span className="text-gray-300">•</span>
            <span>Exa AI</span>
          </div>
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
