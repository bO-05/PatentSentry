import { Scale, Zap, Shield, TrendingUp, ArrowRight, BarChart3, GitBranch, Brain, Github, Twitter } from 'lucide-react';

interface LandingPageProps {
  onEnterApp: () => void;
}

export default function LandingPage({ onEnterApp }: LandingPageProps) {
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

      <section className="relative min-h-screen flex items-center justify-center px-6">
        <div className="max-w-5xl mx-auto text-center z-10">
          <div className="mb-8 animate-fade-in">
            <div className="inline-flex items-center gap-3 mb-6 px-5 py-2.5 bg-white/80 backdrop-blur-sm rounded-full border border-blue-100 shadow-sm">
              <Scale className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">PatentSentry</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight mb-6 tracking-tight">
              Know the Exact Day
              <br />
              <span className="text-blue-600">a Patent Dies</span>
            </h1>
          </div>

          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Google Patents <span className="text-blue-600 font-semibold">estimates</span>.
            We <span className="text-blue-600 font-semibold">calculate</span> the exact expiration date including
            Patent Term Adjustments and Terminal Disclaimers.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <button
              onClick={onEnterApp}
              className="group px-8 py-4 bg-blue-600 text-white text-base font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              Start Analyzing Patents
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#features"
              className="px-8 py-4 bg-white text-gray-700 text-base font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm border border-gray-200"
            >
              See Features
            </a>
          </div>

          <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="text-3xl font-bold text-blue-600 mb-1">100%</div>
              <div className="text-sm text-gray-600">Accurate Calculations</div>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="text-3xl font-bold text-blue-600 mb-1">10M+</div>
              <div className="text-sm text-gray-600">US Patents</div>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="text-3xl font-bold text-blue-600 mb-1">&lt;1s</div>
              <div className="text-sm text-gray-600">Analysis Time</div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why PatentSentry?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Features that make patent research faster and more insightful
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="group bg-slate-50 rounded-2xl p-8 border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-200">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Exact Expiration Dates</h3>
              <p className="text-gray-600">
                Calculate precise expiration with Patent Term Adjustments (PTA) and Terminal Disclaimers factored in.
              </p>
            </div>

            <div className="group bg-slate-50 rounded-2xl p-8 border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-200">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Visual Timeline</h3>
              <p className="text-gray-600">
                See patent lifecycles on an interactive timeline. Track filing, grant, and expiration dates visually.
              </p>
            </div>

            <div className="group bg-slate-50 rounded-2xl p-8 border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-200">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Brain className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">AI-Powered Search</h3>
              <p className="text-gray-600">
                Describe technology in plain English. AI expands your query into precise patent search terms.
              </p>
            </div>

            <div className="group bg-slate-50 rounded-2xl p-8 border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-200">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Filing Trends</h3>
              <p className="text-gray-600">
                Visualize patent filing trends over time. See which companies are most active in your technology area.
              </p>
            </div>

            <div className="group bg-slate-50 rounded-2xl p-8 border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-200">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <GitBranch className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Patent Families</h3>
              <p className="text-gray-600">
                Discover related patents and continuations. Understand how patent portfolios are structured.
              </p>
            </div>

            <div className="group bg-slate-50 rounded-2xl p-8 border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-200">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Save & Organize</h3>
              <p className="text-gray-600">
                Bookmark patents for later. Build collections and export your research for reports.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-blue-600 rounded-2xl p-12 shadow-xl">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to get started?
            </h2>
            <p className="text-blue-100 mb-8 max-w-xl mx-auto">
              Join researchers, attorneys, and innovators who trust PatentSentry for accurate patent expiration analysis.
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
          <p className="text-sm text-gray-500 text-center mb-4">
            Powered by USPTO PatentsView API and Supabase
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
