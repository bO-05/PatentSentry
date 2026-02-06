import { useState, useMemo } from 'react';
import { GitBranch, RefreshCw, AlertCircle, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { getClaimGraph, ClaimGraphResult } from '../lib/api';
import { AIDisclaimer } from './AIDisclaimer';

interface ClaimGraphPanelProps {
  patentId: string;
  patentTitle: string;
  patentAbstract: string;
  claimsText?: string;
}

interface ClaimNode {
  claim_id: number;
  type: 'independent' | 'dependent';
  depends_on: number[];
  essence: string;
  key_elements: string[];
}

export default function ClaimGraphPanel({
  patentId,
  patentTitle,
  patentAbstract,
  claimsText,
}: ClaimGraphPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ClaimGraphResult | null>(null);
  const [expandedClaims, setExpandedClaims] = useState<Set<number>>(new Set());
  const [selectedClaim, setSelectedClaim] = useState<number | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const fetchGraph = async () => {
    setHasStarted(true);
    setLoading(true);
    setError(null);
    try {
      const result = await getClaimGraph(patentId, patentTitle, patentAbstract, claimsText);
      if (result.error || result.available === false) {
        setError(result.error || result.reason || 'Claim graph unavailable');
      } else {
        setData(result);
        // Auto-expand independent claims
        const independentClaims = result.claims
          .filter(c => c.type === 'independent')
          .map(c => c.claim_id);
        setExpandedClaims(new Set(independentClaims));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claim graph');
    } finally {
      setLoading(false);
    }
  };



  // Build dependency tree structure
  const { independentClaims, dependencyMap } = useMemo(() => {
    if (!data?.claims) return { independentClaims: [], dependencyMap: new Map() };

    const independent = data.claims.filter(c => c.type === 'independent');
    const depMap = new Map<number, ClaimNode[]>();

    // Group dependent claims by their parent
    for (const claim of data.claims) {
      if (claim.type === 'dependent' && claim.depends_on.length > 0) {
        const parentId = claim.depends_on[0]; // Primary dependency
        if (!depMap.has(parentId)) {
          depMap.set(parentId, []);
        }
        depMap.get(parentId)!.push(claim);
      }
    }

    return { independentClaims: independent, dependencyMap: depMap };
  }, [data]);

  // Get claims that depend on a specific claim (for highlighting)
  const getDependents = (claimId: number): number[] => {
    if (!data?.claims) return [];
    return data.claims
      .filter(c => c.depends_on.includes(claimId))
      .map(c => c.claim_id);
  };

  const toggleExpand = (claimId: number) => {
    setExpandedClaims(prev => {
      const next = new Set(prev);
      if (next.has(claimId)) {
        next.delete(claimId);
      } else {
        next.add(claimId);
      }
      return next;
    });
  };

  const renderClaimNode = (claim: ClaimNode, depth: number = 0) => {
    const dependents = dependencyMap.get(claim.claim_id) || [];
    const hasDependents = dependents.length > 0;
    const isExpanded = expandedClaims.has(claim.claim_id);
    const isSelected = selectedClaim === claim.claim_id;
    const isHighlighted = selectedClaim !== null && claim.depends_on.includes(selectedClaim);
    const isDependentHighlighted = selectedClaim !== null && getDependents(selectedClaim).includes(claim.claim_id);

    return (
      <div key={claim.claim_id} className="relative">
        {/* Connection line for nested claims */}
        {depth > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 border-l-2 border-gray-300"
            style={{ left: `${(depth - 1) * 24 + 12}px` }}
          />
        )}

        <div
          className={`
            relative flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all
            ${depth > 0 ? 'ml-6' : ''}
            ${isSelected ? 'bg-blue-100 ring-2 ring-blue-500' : ''}
            ${isHighlighted ? 'bg-amber-50 ring-1 ring-amber-400' : ''}
            ${isDependentHighlighted ? 'bg-green-50 ring-1 ring-green-400' : ''}
            ${!isSelected && !isHighlighted && !isDependentHighlighted ? 'hover:bg-gray-50' : ''}
          `}
          onClick={() => setSelectedClaim(isSelected ? null : claim.claim_id)}
        >
          {/* Expand/collapse button */}
          {hasDependents ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(claim.claim_id);
              }}
              className="mt-0.5 p-1 hover:bg-gray-200 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}

          {/* Claim badge */}
          <div
            className={`
              flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
              ${claim.type === 'independent'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700'
              }
            `}
          >
            {claim.claim_id}
          </div>

          {/* Claim content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`
                  text-xs font-medium px-2 py-0.5 rounded-full
                  ${claim.type === 'independent'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                  }
                `}
              >
                {claim.type === 'independent' ? 'Independent' : 'Dependent'}
              </span>
              {claim.depends_on.length > 0 && (
                <span className="text-xs text-gray-500">
                  → Claim {claim.depends_on.join(', ')}
                </span>
              )}
            </div>

            <p className="text-sm text-gray-900 leading-snug">{claim.essence}</p>

            {/* Key elements (shown when selected) */}
            {isSelected && claim.key_elements.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {claim.key_elements.map((elem, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                  >
                    {elem}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Render dependent claims recursively */}
        {hasDependents && isExpanded && (
          <div className="mt-1 space-y-1">
            {dependents.map((dep: ClaimNode) => renderClaimNode(dep, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!hasStarted) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Claim Dependency Graph</h3>
              <p className="text-sm text-gray-500">Visual claim structure</p>
            </div>
          </div>
        </div>
        <div className="p-6 text-center">
          <GitBranch className="w-12 h-12 text-blue-300 mx-auto mb-3" />
          <p className="text-gray-600 text-sm mb-4 max-w-sm mx-auto">
            AI-powered visualization of claim dependencies and relationships.
          </p>
          <button
            onClick={fetchGraph}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            Analyze Claims
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-gray-400 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Claim Dependency Graph</h3>
            <p className="text-sm text-gray-500">Analyzing patent claims...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="flex-1 h-4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Claim Graph Unavailable</h3>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        </div>
        <button
          onClick={fetchGraph}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!data || !data.claims || data.claims.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">No Claims Found</h3>
            <p className="text-sm text-gray-500">Unable to extract claim structure from this patent.</p>
          </div>
        </div>
      </div>
    );
  }

  const independentCount = data.claims.filter(c => c.type === 'independent').length;
  const dependentCount = data.claims.filter(c => c.type === 'dependent').length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Claim Dependency Graph</h3>
              <p className="text-sm text-gray-600">
                {data.claims.length} claims: {independentCount} independent, {dependentCount} dependent
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Powered by Gemini 3</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-blue-600 rounded-full" />
          <span className="text-gray-600">Independent claim</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-gray-300 rounded-full" />
          <span className="text-gray-600">Dependent claim</span>
        </div>
        <span className="text-gray-400 ml-auto">Click a claim to see dependencies</span>
      </div>

      {/* Graph */}
      <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
        {independentClaims.map(claim => renderClaimNode(claim, 0))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200">
        <AIDisclaimer compact />
      </div>
    </div>
  );
}
