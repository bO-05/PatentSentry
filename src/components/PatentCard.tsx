import { useState, useEffect, useCallback } from 'react';
import { FileText, Calendar, Building2, Users, ChevronDown, ChevronUp, Copy, Check, Bookmark, BookmarkCheck, GitBranch, ExternalLink, Quote } from 'lucide-react';
import { PatentSearchResult } from '../types/patent';
import { addBookmark, removeBookmark, isBookmarked } from '../lib/supabase';
import { prefetchPatentAnalysis, prefetchEnrichment } from '../lib/api';

interface PatentCardProps {
  patent: PatentSearchResult;
  onAnalyze: (patentId: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (patent: Record<string, unknown>) => void;
  showSelection?: boolean;
  isActive?: boolean;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export default function PatentCard({ patent, onAnalyze, isSelected = false, onToggleSelect, showSelection = false, isActive: isActiveResult = false }: PatentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCitation, setCopiedCitation] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  useEffect(() => {
    checkBookmarkStatus();
  }, [patent.patent_id]);

  const checkBookmarkStatus = async () => {
    const status = await isBookmarked(patent.patent_id);
    setBookmarked(status);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Date unknown';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Date unknown';
    return dateFormatter.format(date);
  };

  const getPatentUrl = () => {
    const fullId = getFullPatentId();
    return `https://patents.google.com/patent/${fullId}`;
  };

  const generateCitation = () => {
    const assignee = patent.assignees?.[0]?.assignee_organization || 'Unknown Assignee';
    const date = patent.patent_date ? new Date(patent.patent_date) : null;
    const year = date && !isNaN(date.getTime()) ? date.getFullYear() : '';
    const fullId = getFullPatentId();
    return `${assignee}, "${patent.patent_title}," ${fullId}${year ? `, ${year}` : ''}.`;
  };

  const handleCopyCitation = async () => {
    try {
      await navigator.clipboard.writeText(generateCitation());
      setCopiedCitation(true);
      setTimeout(() => setCopiedCitation(false), 2000);
    } catch {
      // Silently fail
    }
  };

  const estimateIsActive = (grantDateStr: string | null | undefined) => {
    if (!grantDateStr) return null;
    const grantDate = new Date(grantDateStr);
    if (isNaN(grantDate.getTime())) return null;
    const estimatedExpiry = new Date(grantDate.getTime() + 20 * 365.25 * 24 * 60 * 60 * 1000);
    return new Date() < estimatedExpiry;
  };

  const getFullPatentId = () => {
    const id = patent.patent_id;
    if (id.toUpperCase().startsWith('US')) {
      return id;
    }
    return `US${id}`;
  };

  const handleCopyPatentId = async () => {
    try {
      await navigator.clipboard.writeText(getFullPatentId());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail
    }
  };

  const [bookmarkError, setBookmarkError] = useState<string | null>(null);

  const handleToggleBookmark = async () => {
    setBookmarkLoading(true);
    setBookmarkError(null);
    let errorSet = false;
    try {
      if (bookmarked) {
        const success = await removeBookmark(patent.patent_id);
        if (success) {
          setBookmarked(false);
        } else {
          setBookmarkError('Sign in to remove bookmarks');
          errorSet = true;
        }
      } else {
        const success = await addBookmark(patent.patent_id, patent.patent_title, patent.patent_date);
        if (success) {
          setBookmarked(true);
        } else {
          setBookmarkError('Sign in to bookmark patents');
          errorSet = true;
        }
      }
    } catch {
      setBookmarkError('Sign in to bookmark patents');
      errorSet = true;
    } finally {
      setBookmarkLoading(false);
      // Clear error after 3 seconds
      if (errorSet) {
        setTimeout(() => setBookmarkError(null), 3000);
      }
    }
  };

  const handlePrefetch = useCallback(() => {
    prefetchPatentAnalysis(patent.patent_id);
    // Also prefetch enrichment data for faster analysis view
    const assignee = patent.assignees?.[0]?.assignee_organization;
    if (assignee) {
      prefetchEnrichment(patent.patent_id, patent.patent_title, assignee);
    }
  }, [patent.patent_id, patent.patent_title, patent.assignees]);

  const primaryAssignee = patent.assignees?.[0];
  const inventors = patent.inventors || [];
  const inventorNames = inventors.map(inv =>
    `${inv.inventor_name_first || inv.inventor_first_name || ''} ${inv.inventor_name_last || inv.inventor_last_name || ''}`.trim()
  ).filter(name => name.length > 0);

  const abstractPreview = patent.patent_abstract?.substring(0, 200) || '';
  const hasMoreAbstract = (patent.patent_abstract?.length || 0) > 200;
  const isActive = estimateIsActive(patent.patent_date);

  const getYearsAgo = (dateStr: string | null | undefined): number | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };
  const yearsAgo = getYearsAgo(patent.patent_date);

  const getPatentTypeInfo = (type: string | undefined, isApplication?: boolean) => {
    if (isApplication || type?.toLowerCase() === 'application') {
      return { label: 'Application', color: 'bg-amber-100 text-amber-800', isApplication: true };
    }
    if (!type) return null;

    const lowerType = type.toLowerCase();
    if (lowerType.includes('utility')) {
      return { label: 'Utility', color: 'bg-blue-100 text-blue-800', isApplication: false };
    } else if (lowerType.includes('design')) {
      return { label: 'Design', color: 'bg-teal-100 text-teal-800', isApplication: false };
    } else if (lowerType.includes('plant')) {
      return { label: 'Plant', color: 'bg-green-100 text-green-800', isApplication: false };
    } else if (lowerType.includes('reissue')) {
      return { label: 'Reissue', color: 'bg-orange-100 text-orange-800', isApplication: false };
    }
    return { label: type, color: 'bg-gray-100 text-gray-800', isApplication: false };
  };

  const isApplication = (patent as unknown as { is_application?: boolean }).is_application === true;
  const patentTypeInfo = getPatentTypeInfo(patent.patent_type, isApplication);
  const relatedDocs = patent.us_related_documents || [];
  const hasFamily = relatedDocs.length > 0;

  return (
    <article 
      className={`group relative bg-white border rounded-xl p-5 transition-all duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${isActiveResult
        ? 'border-blue-500 ring-2 ring-blue-200 shadow-md'
        : isSelected
          ? 'border-blue-400 ring-2 ring-blue-100'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
        }`}
      tabIndex={0}
    >
      {isSelected && (
        <div className="absolute top-2 left-2 bg-blue-600 text-white rounded-full p-1 z-10">
          <Check className="w-3 h-3" />
        </div>
      )}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
        <button
          type="button"
          onClick={handleToggleBookmark}
          disabled={bookmarkLoading}
          className={`p-1.5 rounded-lg transition-colors shadow-sm ${bookmarked
            ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
            : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
            } ${bookmarkLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
        >
          {bookmarked ? (
            <BookmarkCheck className="w-4 h-4" />
          ) : (
            <Bookmark className="w-4 h-4" />
          )}
        </button>
        {showSelection && onToggleSelect && (
          <button
            type="button"
            onClick={() => onToggleSelect(patent as unknown as Record<string, unknown>)}
            className={`p-1.5 rounded-lg transition-colors shadow-sm ${isSelected
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
              }`}
            aria-label={isSelected ? 'Deselect patent' : 'Select for comparison'}
          >
            <Check className="w-4 h-4" />
          </button>
        )}
        <a
          href={getPatentUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg bg-white text-gray-500 hover:bg-gray-100 border border-gray-200 shadow-sm transition-colors"
          aria-label="View on Google Patents"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
      <div className="flex items-start gap-4">
        {showSelection && onToggleSelect && (
          <button
            type="button"
            onClick={() => onToggleSelect(patent as unknown as Record<string, unknown>)}
            className={`mt-1 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-gray-300 hover:border-blue-400'
              }`}
            aria-label={isSelected ? 'Deselect patent' : 'Select patent for comparison'}
          >
            {isSelected && <Check className="w-3.5 h-3.5" />}
          </button>
        )}
        <div className="p-2.5 bg-slate-100 rounded-lg flex-shrink-0" aria-hidden="true">
          <FileText className="w-5 h-5 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 mb-2 leading-snug line-clamp-2" title={patent.patent_title}>
            {patent.patent_title}
          </h3>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md text-sm font-medium text-slate-700"
            >
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              {formatDate(patent.patent_date)}
              {yearsAgo !== null && (
                <span className="text-xs text-gray-400 ml-1">({yearsAgo}y ago)</span>
              )}
            </span>
            {!isApplication && isActive !== null && (
              <span
                className={`px-2.5 py-1 text-xs font-semibold rounded-md ${isActive
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-100 text-gray-600'
                  }`}
              >
                {isActive ? 'Likely Active' : 'Likely Expired'}
              </span>
            )}
            {isApplication && (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-100 text-amber-800">
                Pending
              </span>
            )}
            {patentTypeInfo && (
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ${patentTypeInfo.color}`}>
                {patentTypeInfo.label}
              </span>
            )}
            {hasFamily && (
              <span
                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 inline-flex items-center gap-1"
                title={`${relatedDocs.length} related document${relatedDocs.length > 1 ? 's' : ''}`}
              >
                <GitBranch className="w-3 h-3" aria-hidden="true" />
                <span className="tabular-nums">{relatedDocs.length}</span>
              </span>
            )}
            <div className="inline-flex items-center gap-1.5">
              <code className="text-sm text-gray-500 font-mono">
                {getFullPatentId()}
              </code>
              <button
                type="button"
                onClick={handleCopyPatentId}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label={copied ? 'Copied patent ID' : 'Copy patent ID'}
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {primaryAssignee && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
              <span className="font-medium truncate">{primaryAssignee.assignee_organization}</span>
              {primaryAssignee.assignee_type && (
                <span className="text-gray-400">({primaryAssignee.assignee_type})</span>
              )}
            </div>
          )}

          {inventorNames.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-gray-500 mb-3">
              <Users className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">
                {inventorNames.slice(0, 3).join(', ')}
                {inventorNames.length > 3 && (
                  <span className="text-gray-400">{` +${inventorNames.length - 3} more`}</span>
                )}
              </span>
            </div>
          )}

          {patent.patent_abstract && (
            <div className="text-gray-600 text-sm mb-4 leading-relaxed">
              <p className={isExpanded ? '' : 'line-clamp-2'}>
                {isExpanded ? patent.patent_abstract : abstractPreview}
                {!isExpanded && hasMoreAbstract && '...'}
              </p>
              {hasMoreAbstract && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-1.5 text-blue-600 hover:text-blue-700 font-medium text-sm inline-flex items-center gap-1"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4" aria-hidden="true" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" aria-hidden="true" />
                      Read more
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onAnalyze(patent.patent_id)}
              onMouseEnter={handlePrefetch}
              onFocus={handlePrefetch}
              className="px-3.5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              {isApplication ? 'View Details' : 'Analyze Expiration'}
            </button>
            <a
              href={getPatentUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              aria-label="View patent on Google Patents (opens in new tab)"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">View</span>
            </a>
            <button
              type="button"
              onClick={handleCopyCitation}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${copiedCitation
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              aria-label={copiedCitation ? 'Citation copied' : 'Copy citation'}
            >
              {copiedCitation ? (
                <Check className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Quote className="w-4 h-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{copiedCitation ? 'Copied' : 'Cite'}</span>
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={handleToggleBookmark}
                disabled={bookmarkLoading}
                className={`p-2 rounded-lg transition-colors ${bookmarked
                  ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  } ${bookmarkLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
                aria-pressed={bookmarked}
              >
                {bookmarked ? (
                  <BookmarkCheck className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Bookmark className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
              {/* Auth required tooltip */}
              {bookmarkError && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                  {bookmarkError}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
