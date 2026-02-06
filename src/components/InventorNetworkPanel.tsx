import { useState, useMemo, useCallback } from 'react';
import { Network, Users, RefreshCw, AlertCircle, Star, X } from 'lucide-react';
import { Skeleton } from './Skeleton';
import { getInventorNetwork, InventorNetworkResult } from '../lib/api';

type InventorNode = InventorNetworkResult['nodes'][number];
type InventorEdge = InventorNetworkResult['edges'][number];
type InventorCluster = InventorNetworkResult['clusters'][number];

interface InventorNetworkPanelProps {
  assignee?: string;
  inventorName?: string;
  patentIds?: string[];
}

const CLUSTER_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];

function getClusterColor(clusterIndex: number): string {
  return CLUSTER_COLORS[clusterIndex % CLUSTER_COLORS.length];
}

interface NodePosition {
  x: number;
  y: number;
}

function calculateNodePositions(
  nodes: InventorNetworkResult['nodes'],
  width: number,
  height: number
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;

  nodes.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
    positions.set(node.id, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  });

  return positions;
}

function getNodeRadius(patentCount: number, maxCount: number): number {
  const minRadius = 8;
  const maxRadius = 24;
  const normalized = maxCount > 1 ? patentCount / maxCount : 0.5;
  return minRadius + normalized * (maxRadius - minRadius);
}

interface TooltipData {
  node: InventorNetworkResult['nodes'][0];
  x: number;
  y: number;
}

export default function InventorNetworkPanel({
  assignee,
  inventorName,
  patentIds,
}: InventorNetworkPanelProps) {
  const [data, setData] = useState<InventorNetworkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const fetchNetwork = useCallback(async () => {
    if (!assignee && !inventorName && (!patentIds || patentIds.length === 0)) {
      setError('No search criteria provided');
      setLoading(false);
      return;
    }

    setHasStarted(true);
    setLoading(true);
    setError(null);

    try {
      const result = await getInventorNetwork({
        assignee,
        inventorName,
        patentIds,
      });

      if (result.available === false) {
        setError(result.error || 'Inventor network data not available');
        setData(null);
      } else {
        setData(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventor network');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [assignee, inventorName, patentIds]);

  const svgWidth = 500;
  const svgHeight = 400;

  const nodePositions = useMemo(() => {
    if (!data?.nodes) return new Map<string, NodePosition>();
    return calculateNodePositions(data.nodes, svgWidth, svgHeight);
  }, [data?.nodes]);

  const maxPatentCount = useMemo(() => {
    if (!data?.nodes) return 1;
    return Math.max(...data.nodes.map((n) => n.patent_count), 1);
  }, [data?.nodes]);

  const nodeClusterMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!data?.clusters) return map;
    data.clusters.forEach((cluster, idx) => {
      cluster.inventors.forEach((inventorId) => {
        map.set(inventorId, idx);
      });
    });
    return map;
  }, [data?.clusters]);

  const connectedNodes = useMemo(() => {
    if (!selectedNode || !data?.edges) return new Set<string>();
    const connected = new Set<string>();
    data.edges.forEach((edge) => {
      if (edge.source === selectedNode) connected.add(edge.target);
      if (edge.target === selectedNode) connected.add(edge.source);
    });
    return connected;
  }, [selectedNode, data?.edges]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleNodeHover = useCallback(
    (node: InventorNode | null, event?: React.MouseEvent) => {
      if (node && event) {
        const rect = (event.target as SVGElement).getBoundingClientRect();
        setTooltip({
          node,
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      } else {
        setTooltip(null);
      }
    },
    []
  );

  const isNodeHighlighted = useCallback(
    (nodeId: string): boolean => {
      if (!selectedNode) return true;
      return nodeId === selectedNode || connectedNodes.has(nodeId);
    },
    [selectedNode, connectedNodes]
  );

  const isEdgeHighlighted = useCallback(
    (edge: InventorEdge): boolean => {
      if (!selectedNode) return true;
      return edge.source === selectedNode || edge.target === selectedNode;
    },
    [selectedNode]
  );

  if (!hasStarted) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Inventor Network</h3>
              <p className="text-sm text-gray-500">Collaboration patterns</p>
            </div>
          </div>
        </div>
        <div className="p-6 text-center">
          <Users className="w-12 h-12 text-teal-300 mx-auto mb-3" />
          <p className="text-gray-600 text-sm mb-4 max-w-sm mx-auto">
            Visualize inventor collaboration networks and expertise clusters.
          </p>
          <button
            onClick={fetchNetwork}
            className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm"
          >
            Load Network
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-slate-100 rounded-lg">
            <Network className="w-5 h-5 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Inventor Network</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchNetwork}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-slate-100 rounded-lg">
            <Network className="w-5 h-5 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Inventor Network</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Users className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-500">No inventor data found</p>
        </div>
      </div>
    );
  }

  const mostConnectedId = data.stats?.most_connected_inventor;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Network className="w-5 h-5 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Inventor Network</h3>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span className="font-medium">{data.stats?.total_inventors ?? data.nodes.length}</span> inventors
            </span>
            <span>
              <span className="font-medium">{data.stats?.total_collaborations ?? data.edges.length}</span> collaborations
            </span>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Network Graph */}
        <div className="flex-1 p-4 relative">
          {selectedNode && (
            <button
              onClick={() => setSelectedNode(null)}
              className="absolute top-6 right-6 z-10 p-1.5 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <svg
            width="100%"
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="overflow-visible"
          >
            {/* Edges */}
            {data.edges.map((edge, idx) => {
              const sourcePos = nodePositions.get(edge.source);
              const targetPos = nodePositions.get(edge.target);
              if (!sourcePos || !targetPos) return null;

              const highlighted = isEdgeHighlighted(edge);
              const strokeWidth = Math.min(1 + edge.weight, 4);

              return (
                <line
                  key={`edge-${idx}`}
                  x1={sourcePos.x}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  stroke={highlighted ? '#94A3B8' : '#E2E8F0'}
                  strokeWidth={strokeWidth}
                  opacity={highlighted ? 0.6 : 0.2}
                  className="transition-all duration-200"
                />
              );
            })}

            {/* Nodes */}
            {data.nodes.map((node) => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;

              const radius = getNodeRadius(node.patent_count, maxPatentCount);
              const highlighted = isNodeHighlighted(node.id);
              const isSelected = selectedNode === node.id;
              const isMostConnected = mostConnectedId === node.id;
              const clusterIdx = nodeClusterMap.get(node.id) ?? 0;

              return (
                <g key={node.id}>
                  {/* Most connected indicator */}
                  {isMostConnected && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={radius + 6}
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                      className="animate-pulse"
                    />
                  )}
                  {/* Selection ring */}
                  {isSelected && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={radius + 4}
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth={2}
                    />
                  )}
                  {/* Node circle */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={radius}
                    fill={getClusterColor(clusterIdx)}
                    opacity={highlighted ? 1 : 0.3}
                    stroke={isSelected ? '#1E40AF' : '#fff'}
                    strokeWidth={2}
                    className="cursor-pointer transition-all duration-200 hover:opacity-100"
                    onClick={() => handleNodeClick(node.id)}
                    onMouseEnter={(e) => handleNodeHover(node, e)}
                    onMouseLeave={() => handleNodeHover(null)}
                  />
                  {/* Node label (for larger nodes) */}
                  {radius >= 14 && (
                    <text
                      x={pos.x}
                      y={pos.y + radius + 14}
                      textAnchor="middle"
                      className="text-xs fill-gray-600 pointer-events-none"
                      opacity={highlighted ? 1 : 0.3}
                    >
                      {node.name.split(' ').pop()}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="fixed z-50 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg pointer-events-none"
              style={{
                left: tooltip.x,
                top: tooltip.y - 10,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="font-medium">{tooltip.node.name}</div>
              <div className="text-gray-300 text-xs mt-1">
                {tooltip.node.patent_count} patent{tooltip.node.patent_count !== 1 ? 's' : ''}
              </div>
              {tooltip.node.expertise_areas.length > 0 && (
                <div className="text-gray-400 text-xs mt-1">
                  {tooltip.node.expertise_areas.slice(0, 3).join(', ')}
                </div>
              )}
              <div
                className="absolute left-1/2 -bottom-1 w-2 h-2 bg-gray-900 rotate-45 -translate-x-1/2"
              />
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <span>Node size = patent count</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-gray-400" />
              <span>Line thickness = collaboration strength</span>
            </div>
          </div>
        </div>

        {/* Clusters Panel */}
        <div className="w-64 border-l border-gray-100 bg-gray-50 p-4 overflow-y-auto max-h-[500px]">
          {/* Most Connected */}
          {mostConnectedId && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Most Connected
              </h4>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="font-medium text-gray-900">
                    {data.nodes.find((n) => n.id === mostConnectedId)?.name || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Clusters */}
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Clusters ({data.clusters.length})
          </h4>
          <div className="space-y-3">
            {data.clusters.map((cluster, idx) => (
              <ClusterCard key={cluster.id} cluster={cluster} colorIndex={idx} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClusterCard({ cluster, colorIndex }: { cluster: InventorCluster; colorIndex: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-start gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
          style={{ backgroundColor: getClusterColor(colorIndex) }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {cluster.focus_area}
          </div>
          {cluster.common_assignee && (
            <div className="text-xs text-gray-500 truncate">{cluster.common_assignee}</div>
          )}
        </div>
      </div>
      <div className="text-xs text-gray-500">
        {expanded
          ? cluster.inventors.join(', ')
          : cluster.inventors.slice(0, 2).join(', ') +
            (cluster.inventors.length > 2 ? ` +${cluster.inventors.length - 2}` : '')}
      </div>
      {cluster.inventors.length > 2 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 hover:text-blue-700 mt-1"
        >
          {expanded ? 'Show less' : 'Show all'}
        </button>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <Skeleton className="w-32 h-6" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="w-24 h-4" />
            <Skeleton className="w-28 h-4" />
          </div>
        </div>
      </div>
      <div className="flex">
        <div className="flex-1 p-4">
          <div className="flex items-center justify-center h-[400px]">
            <div className="relative w-[200px] h-[200px]">
              {[...Array(8)].map((_, i) => {
                const angle = (2 * Math.PI * i) / 8 - Math.PI / 2;
                const x = 100 + 80 * Math.cos(angle);
                const y = 100 + 80 * Math.sin(angle);
                return (
                  <div
                    key={i}
                    className="absolute w-6 h-6 rounded-full animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200"
                    style={{
                      left: x,
                      top: y,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <div className="w-64 border-l border-gray-100 bg-gray-50 p-4">
          <Skeleton className="w-24 h-4 mb-3" />
          <Skeleton className="w-full h-16 rounded-lg mb-4" />
          <Skeleton className="w-20 h-4 mb-3" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="w-full h-20 rounded-lg mb-3" />
          ))}
        </div>
      </div>
    </div>
  );
}
