import { useState } from 'react';
import { Brain, Lightbulb, Target, Shield, Users, Loader2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { getAIPatentAnalysis, AIAnalysisResult } from '../lib/api';
import { AIDisclaimer } from './AIDisclaimer';

interface AIAnalysisPanelProps {
    patentId: string;
    patentTitle: string;
    patentAbstract: string;
    assignee?: string;
    filingDate?: string;
    expirationDate?: string;
}

/**
 * AI Analysis Panel - On-demand Gemini 3 patent intelligence
 * Provides claims summary, technical scope, FTO considerations, and more
 * 
 * Design: Clean white card with high-contrast text for maximum readability
 * Color icons for visual hierarchy, dark text for accessibility (WCAG 2.1 AA)
 */
export default function AIAnalysisPanel({
    patentId,
    patentTitle,
    patentAbstract,
    assignee,
    filingDate,
    expirationDate,
}: AIAnalysisPanelProps) {
    const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);

    const handleAnalyze = async (forceRefresh = false) => {
        if (loading) return; // Prevent double-clicks

        setHasStarted(true);
        setLoading(true);
        setError(null);

        try {
            const result = await getAIPatentAnalysis(
                patentId,
                patentTitle,
                patentAbstract,
                {
                    assignee,
                    filingDate,
                    expirationDate,
                    forceRefresh,
                }
            );

            if (result.available === false) {
                setError(result.reason || result.error || 'AI analysis unavailable');
                setAnalysis(null);
            } else {
                setAnalysis(result);
                setExpanded(true);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get AI analysis');
            setAnalysis(null);
        } finally {
            setLoading(false);
        }
    };

    // Section Component for consistent styling - HIGH CONTRAST
    const Section = ({
        icon: Icon,
        title,
        children,
        iconColor = 'text-blue-600'
    }: {
        icon: React.ComponentType<{ className?: string }>;
        title: string;
        children: React.ReactNode;
        iconColor?: string;
    }) => (
        <div className="mb-5 last:mb-0">
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
                <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed pl-6">
                {children}
            </div>
        </div>
    );

    if (!hasStarted) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                            <Brain className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">AI Patent Analysis</h3>
                            <p className="text-sm text-gray-500">3-step intelligence pipeline</p>
                        </div>
                    </div>
                </div>
                <div className="p-6 text-center">
                    <Brain className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                    <p className="text-gray-600 text-sm mb-4 max-w-sm mx-auto">
                        Get AI-powered claims summary, technical scope, innovations, and FTO considerations.
                    </p>
                    <button
                        onClick={() => handleAnalyze()}
                        className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm"
                    >
                        Generate AI Analysis
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-100 rounded">
                            <Brain className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900">AI Patent Analysis</h3>
                            <p className="text-xs text-gray-500">Powered by Gemini 3</p>
                        </div>
                    </div>

                    {!analysis && !loading && (
                        <button
                            onClick={() => handleAnalyze()}
                            // Prefetch disabled to avoid rate limiting - uncomment when quota is higher
                            // onMouseEnter={() => prefetchAIAnalysis(patentId, patentTitle, patentAbstract, { assignee, filingDate, expirationDate })}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
                        >
                            <Sparkles className="w-4 h-4" />
                            Analyze with AI
                        </button>
                    )}

                    {analysis && (
                        <button
                            onClick={() => handleAnalyze(true)}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            title="Regenerate analysis"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    )}
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="px-4 py-8 flex flex-col items-center justify-center bg-gray-50">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                    <p className="text-sm text-gray-700 font-medium">Analyzing patent with Gemini 3...</p>
                    <p className="text-xs text-gray-500 mt-1">This may take a few seconds</p>
                </div>
            )}

            {/* Error State - Smart contextual feedback */}
            {error && !loading && (
                <div className="px-4 py-4">
                    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm text-red-800 font-medium">{error}</p>

                            {/* Sign in required - show login guidance */}
                            {error.toLowerCase().includes('sign in') && (
                                <p className="text-xs text-red-600 mt-2">
                                    Click the <strong>Sign In</strong> button in the top right to access this feature.
                                </p>
                            )}

                            {/* Rate limit - show wait message */}
                            {(error.toLowerCase().includes('too many requests') || error.toLowerCase().includes('rate limit')) && (
                                <p className="text-xs text-red-600 mt-2">
                                    Our AI is busy. Please wait <strong>30 seconds</strong> before trying again.
                                </p>
                            )}

                            {/* Server error or other - show retry button */}
                            {!error.toLowerCase().includes('sign in') && (
                                <button
                                    onClick={() => handleAnalyze()}
                                    className="inline-flex items-center gap-2 px-4 py-2 mt-3 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Retry Analysis
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Analysis Results - HIGH CONTRAST */}
            {analysis && !loading && expanded && (
                <div className="px-4 py-4 space-y-1">
                    {/* Claims Summary */}
                    <Section icon={Target} title="What This Patent Protects" iconColor="text-blue-600">
                        <p>{analysis.claims_summary}</p>
                    </Section>

                    {/* Technical Scope */}
                    <Section icon={Brain} title="Technical Scope" iconColor="text-emerald-600">
                        <p>{analysis.technical_scope}</p>
                    </Section>

                    {/* Key Innovations */}
                    <Section icon={Lightbulb} title="Key Innovations" iconColor="text-amber-600">
                        <ul className="list-disc list-inside space-y-1">
                            {analysis.key_innovations.map((innovation, i) => (
                                <li key={i}>{innovation}</li>
                            ))}
                        </ul>
                    </Section>

                    {/* Potential Applications */}
                    <Section icon={Target} title="Potential Applications" iconColor="text-cyan-600">
                        <ul className="list-disc list-inside space-y-1">
                            {analysis.potential_applications.map((app, i) => (
                                <li key={i}>{app}</li>
                            ))}
                        </ul>
                    </Section>

                    {/* FTO Considerations */}
                    <Section icon={Shield} title="Freedom-to-Operate Considerations" iconColor="text-orange-600">
                        <p>{analysis.fto_considerations}</p>
                        <p className="text-xs text-gray-500 mt-2 italic">
                            Note: This is not legal advice. Consult a patent attorney for actual FTO analysis.
                        </p>
                    </Section>

                    {/* Competitive Landscape */}
                    <Section icon={Users} title="Competitive Landscape" iconColor="text-rose-600">
                        <p>{analysis.competitive_landscape}</p>
                    </Section>

                    {/* Disclaimer & Timestamp */}
                    <div className="pt-3 mt-4 border-t border-gray-200">
                        <AIDisclaimer compact />
                        <p className="text-xs text-gray-500 mt-2">
                            Analysis generated: {new Date(analysis.generated_at).toLocaleString()}
                        </p>
                    </div>
                </div>
            )}

            {/* Collapsed State with Results */}
            {analysis && !loading && !expanded && (
                <button
                    onClick={() => setExpanded(true)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                    <p className="text-sm text-gray-700 line-clamp-2">
                        {analysis.claims_summary}
                    </p>
                    <p className="text-xs text-indigo-600 mt-1 font-medium">Click to expand full analysis</p>
                </button>
            )}
        </div>
    );
}
