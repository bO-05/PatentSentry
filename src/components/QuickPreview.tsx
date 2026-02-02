import { useState, useEffect } from 'react';
import { Calendar, Building2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { getPrefetchedAnalysis } from '../lib/api';

interface QuickPreviewProps {
  patentId: string;
  isVisible: boolean;
  position: { x: number; y: number };
}

interface PreviewData {
  patent_id: string;
  title: string;
  dates?: {
    filed?: string;
    granted?: string;
    calculated_expiry?: string;
  };
  assignees?: Array<{ assignee_organization: string }>;
  is_active?: boolean;
  cpc_codes?: Array<{ cpc_code: string }>;
}

export default function QuickPreview({ patentId, isVisible, position }: QuickPreviewProps) {
  const [data, setData] = useState<PreviewData | null>(null);

  useEffect(() => {
    if (!isVisible || !patentId) {
      setData(null);
      return;
    }

    const prefetched = getPrefetchedAnalysis(patentId) as PreviewData | null;
    if (prefetched) {
      setData(prefetched);
    }
  }, [patentId, isVisible]);

  if (!isVisible) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div
      className="fixed z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 pointer-events-none"
      style={{
        left: Math.min(position.x, window.innerWidth - 340),
        top: Math.min(position.y + 10, window.innerHeight - 200),
      }}
    >
      {data ? (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-mono text-gray-500 mb-1">{data.patent_id}</p>
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{data.title}</h3>
          </div>

          {data.assignees?.[0]?.assignee_organization && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate">{data.assignees[0].assignee_organization}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            {data.dates?.filed && (
              <div className="flex items-center gap-1.5 text-gray-600">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>Filed: {formatDate(data.dates.filed)}</span>
              </div>
            )}
            {data.dates?.granted && (
              <div className="flex items-center gap-1.5 text-gray-600">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>Grant: {formatDate(data.dates.granted)}</span>
              </div>
            )}
          </div>

          {data.dates?.calculated_expiry && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">
                Expires: {formatDate(data.dates.calculated_expiry)}
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-gray-100">
            {data.is_active === true ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active
              </span>
            ) : data.is_active === false ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full">
                <XCircle className="w-3.5 h-3.5" />
                Expired
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-50 text-gray-600 text-xs font-medium rounded-full">
                Status Unknown
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
          </div>
          <div className="h-4 w-1/2 bg-gray-200 rounded" />
          <div className="h-4 w-2/3 bg-gray-200 rounded" />
        </div>
      )}
    </div>
  );
}
