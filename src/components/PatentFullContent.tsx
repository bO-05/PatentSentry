import { useState, useMemo } from 'react';
import { FileText, RefreshCw, AlertCircle, ChevronDown, ChevronUp, ExternalLink, Search, Zap, Copy, Check } from 'lucide-react';
import { getPatentContent, FirecrawlResult } from '../lib/api';

interface PatentFullContentProps {
    patentId: string;
    patentTitle?: string;
}

// Simple, efficient markdown parser for patent content
function parseMarkdown(markdown: string): React.ReactNode[] {
    const lines = markdown.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];

    const flushList = () => {
        if (currentList.length > 0) {
            elements.push(
                <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 text-gray-700 mb-4">
                    {currentList.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
            );
            currentList = [];
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Code blocks
        if (line.startsWith('```')) {
            if (inCodeBlock) {
                elements.push(
                    <pre key={`code-${elements.length}`} className="bg-gray-100 p-3 rounded-lg text-sm overflow-x-auto mb-4 font-mono">
                        {codeContent.join('\n')}
                    </pre>
                );
                codeContent = [];
            }
            inCodeBlock = !inCodeBlock;
            continue;
        }

        if (inCodeBlock) {
            codeContent.push(line);
            continue;
        }

        // Headers
        if (line.startsWith('### ')) {
            flushList();
            elements.push(<h3 key={`h3-${i}`} className="text-lg font-semibold text-gray-900 mt-6 mb-3">{line.slice(4)}</h3>);
            continue;
        }
        if (line.startsWith('## ')) {
            flushList();
            elements.push(<h2 key={`h2-${i}`} className="text-xl font-bold text-gray-900 mt-8 mb-4 pb-2 border-b border-gray-200">{line.slice(3)}</h2>);
            continue;
        }
        if (line.startsWith('# ')) {
            flushList();
            elements.push(<h1 key={`h1-${i}`} className="text-2xl font-bold text-gray-900 mt-6 mb-4">{line.slice(2)}</h1>);
            continue;
        }

        // List items
        if (line.match(/^[\-\*]\s/)) {
            currentList.push(line.slice(2));
            continue;
        }
        if (line.match(/^\d+\.\s/)) {
            currentList.push(line.replace(/^\d+\.\s/, ''));
            continue;
        }

        // Images - render as image elements
        const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        if (imgMatch) {
            flushList();
            elements.push(
                <figure key={`img-${i}`} className="my-4">
                    <img
                        src={imgMatch[2]}
                        alt={imgMatch[1] || 'Patent figure'}
                        className="max-w-full h-auto rounded-lg border border-gray-200"
                        loading="lazy"
                    />
                    {imgMatch[1] && <figcaption className="text-sm text-gray-500 mt-2 text-center">{imgMatch[1]}</figcaption>}
                </figure>
            );
            continue;
        }

        // Links
        const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/g);
        if (linkMatch) {
            flushList();
            let processedLine = line;
            linkMatch.forEach(match => {
                const [, text, url] = match.match(/\[([^\]]+)\]\(([^)]+)\)/) || [];
                if (text && url) {
                    processedLine = processedLine.replace(match, `<a href="${url}" class="text-blue-600 hover:underline" target="_blank" rel="noopener">${text}</a>`);
                }
            });
            elements.push(<p key={`p-${i}`} className="text-gray-700 mb-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: processedLine }} />);
            continue;
        }

        // Bold/Italic
        if (line.match(/\*\*[^*]+\*\*/)) {
            flushList();
            const processed = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            elements.push(<p key={`p-${i}`} className="text-gray-700 mb-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: processed }} />);
            continue;
        }

        // Regular paragraphs (skip empty lines)
        if (line.trim()) {
            flushList();
            elements.push(<p key={`p-${i}`} className="text-gray-700 mb-3 leading-relaxed">{line}</p>);
        }
    }

    flushList();
    return elements;
}

export default function PatentFullContent({ patentId, patentTitle }: PatentFullContentProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<FirecrawlResult | null>(null);
    const [hasStarted, setHasStarted] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['abstract', 'claims']));
    const [searchQuery, setSearchQuery] = useState('');
    const [copied, setCopied] = useState(false);

    const fetchContent = async () => {
        setHasStarted(true);
        setLoading(true);
        setError(null);
        try {
            const result = await getPatentContent(patentId);
            if (!result.success || result.available === false) {
                setError(result.error || 'Failed to fetch patent content');
            } else {
                setData(result);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch patent content');
        } finally {
            setLoading(false);
        }
    };

    // Parse markdown into sections for collapsible display
    const sections = useMemo(() => {
        if (!data?.markdown) return [];

        const markdown = data.markdown;
        const sectionRegex = /^##\s+(.+)$/gm;
        const matches = [...markdown.matchAll(sectionRegex)];

        const result: { title: string; content: string; id: string }[] = [];

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const nextMatch = matches[i + 1];
            const startIndex = match.index! + match[0].length;
            const endIndex = nextMatch ? nextMatch.index! : markdown.length;
            const content = markdown.slice(startIndex, endIndex).trim();
            const title = match[1];

            result.push({
                title,
                content,
                id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            });
        }

        // If no sections found, treat entire content as one section
        if (result.length === 0 && markdown.trim()) {
            result.push({
                title: 'Full Document',
                content: markdown,
                id: 'full-document',
            });
        }

        return result;
    }, [data?.markdown]);

    // Filter sections by search
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return sections;
        const query = searchQuery.toLowerCase();
        return sections.filter(s =>
            s.title.toLowerCase().includes(query) ||
            s.content.toLowerCase().includes(query)
        );
    }, [sections, searchQuery]);

    const toggleSection = (id: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const expandAll = () => {
        setExpandedSections(new Set(sections.map(s => s.id)));
    };

    const collapseAll = () => {
        setExpandedSections(new Set());
    };

    const copyToClipboard = async () => {
        if (data?.markdown) {
            await navigator.clipboard.writeText(data.markdown);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Initial state - not started
    if (!hasStarted) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center">
                                <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Full Patent Document</h3>
                                <p className="text-sm text-gray-500">Complete patent content with all sections</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                            <span>Web Scraping</span>
                        </div>
                    </div>
                </div>
                <div className="p-6 text-center">
                    <FileText className="w-12 h-12 text-amber-300 mx-auto mb-3" />
                    <p className="text-gray-600 text-sm mb-4 max-w-sm mx-auto">
                        Fetch the complete patent document with claims, description, and figures.
                    </p>
                    <button
                        onClick={fetchContent}
                        className="px-5 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium text-sm"
                    >
                        Load Full Document
                    </button>
                </div>
            </div>
        );
    }

    // Loading state
    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-gray-400 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Full Patent Document</h3>
                        <p className="text-sm text-gray-500">Fetching content from Google Patents...</p>
                    </div>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                            <div className="h-3 bg-gray-100 rounded w-full mb-1" />
                            <div className="h-3 bg-gray-100 rounded w-5/6" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Document Unavailable</h3>
                        <p className="text-sm text-gray-600">{error}</p>
                    </div>
                </div>
                <button
                    onClick={fetchContent}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                </button>
            </div>
        );
    }

    // Success state with content
    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 rounded">
                            <FileText className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900">Full Patent Document</h3>
                            <span className="text-xs text-gray-500">{sections.length} sections • {data?.markdown?.length?.toLocaleString() || 0} characters</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-36 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                        </div>

                        {/* Actions */}
                        <button
                            onClick={expandAll}
                            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        >
                            Expand All
                        </button>
                        <button
                            onClick={collapseAll}
                            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        >
                            Collapse
                        </button>
                        <button
                            onClick={copyToClipboard}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="Copy markdown"
                        >
                            {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                        <a
                            href={data?.metadata?.sourceURL || `https://patents.google.com/patent/${patentId}/en`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="View on Google Patents"
                        >
                            <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                            onClick={fetchContent}
                            disabled={loading}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Sections */}
            <div className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
                {filteredSections.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                        {searchQuery ? 'No sections match your search' : 'No content available'}
                    </div>
                ) : (
                    filteredSections.map((section) => (
                        <div key={section.id} className="group">
                            <button
                                onClick={() => toggleSection(section.id)}
                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                            >
                                <span className="font-medium text-gray-900 text-left">{section.title}</span>
                                {expandedSections.has(section.id) ? (
                                    <ChevronUp className="w-4 h-4 text-gray-400" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                            </button>

                            {expandedSections.has(section.id) && (
                                <div className="px-4 pb-4 prose prose-sm max-w-none">
                                    {parseMarkdown(section.content)}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            {data?.fetched_at && (
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
                    <span>Fetched: {new Date(data.fetched_at).toLocaleString()}</span>
                    {data.metadata?.title && <span className="truncate ml-4">{data.metadata.title}</span>}
                </div>
            )}
        </div>
    );
}
