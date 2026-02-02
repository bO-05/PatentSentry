import { useMemo } from 'react';
import { BarChart3, Building2, TrendingUp } from 'lucide-react';
import { PatentSearchResult } from '../types/patent';

interface FilingTrendsChartProps {
  patents: PatentSearchResult[];
}

const CHART_HEIGHT = 120;

export default function FilingTrendsChart({ patents }: FilingTrendsChartProps) {
  const { yearData, topAssignees, stats } = useMemo(() => {
    const yearCounts: Record<number, number> = {};
    const assigneeCounts: Record<string, number> = {};
    let activeCount = 0;
    let expiredCount = 0;

    const now = new Date();

    patents.forEach(patent => {
      if (patent.patent_date) {
        const year = new Date(patent.patent_date).getFullYear();
        yearCounts[year] = (yearCounts[year] || 0) + 1;

        const grantDate = new Date(patent.patent_date);
        const estimatedExpiry = new Date(grantDate.getTime() + 20 * 365.25 * 24 * 60 * 60 * 1000);
        if (now < estimatedExpiry) {
          activeCount++;
        } else {
          expiredCount++;
        }
      }

      if (patent.assignees?.[0]?.assignee_organization) {
        const assignee = patent.assignees[0].assignee_organization;
        assigneeCounts[assignee] = (assigneeCounts[assignee] || 0) + 1;
      }
    });

    const years = Object.keys(yearCounts).map(Number).sort((a, b) => a - b);
    const minYear = years[0] || new Date().getFullYear();
    const maxYear = years[years.length - 1] || new Date().getFullYear();

    const filledYearData: { year: number; count: number }[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      filledYearData.push({ year: y, count: yearCounts[y] || 0 });
    }

    const maxCount = Math.max(...filledYearData.map(d => d.count), 1);

    const sortedAssignees = Object.entries(assigneeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      yearData: filledYearData.map(d => ({
        ...d,
        heightPx: Math.max(Math.round((d.count / maxCount) * CHART_HEIGHT), d.count > 0 ? 8 : 0)
      })),
      topAssignees: sortedAssignees,
      stats: {
        total: patents.length,
        active: activeCount,
        expired: expiredCount,
        avgPerYear: filledYearData.length > 0
          ? Math.round(patents.length / filledYearData.length * 10) / 10
          : 0,
      },
    };
  }, [patents]);

  if (patents.length === 0) return null;

  const isSingleYear = yearData.length === 1;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Search Insights</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Patents</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          <div className="text-sm text-gray-600">Likely Active</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-500">{stats.expired}</div>
          <div className="text-sm text-gray-600">Likely Expired</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.avgPerYear}</div>
          <div className="text-sm text-gray-600">Avg/Year</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-700">Filing Trends by Year</h4>
          </div>
          <div className="relative" style={{ height: CHART_HEIGHT + 32 }}>
            <div
              className="absolute bottom-6 left-0 right-0 flex items-end gap-1"
              style={{ height: CHART_HEIGHT }}
            >
              {yearData.map((d) => (
                <div
                  key={d.year}
                  className={`flex flex-col items-center group ${isSingleYear ? 'w-16' : 'flex-1'}`}
                >
                  <div className="relative w-full flex justify-center">
                    <div
                      className="bg-blue-500 rounded-t group-hover:bg-blue-600"
                      style={{
                        height: d.heightPx,
                        width: isSingleYear ? 32 : '100%',
                        maxWidth: 24,
                        minWidth: 8
                      }}
                    />
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none">
                      {d.count} patent{d.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute bottom-0 left-0 right-0 flex gap-1">
              {yearData.map((d) => (
                <div
                  key={`label-${d.year}`}
                  className={`text-center text-xs text-gray-500 ${isSingleYear ? 'w-16' : 'flex-1'}`}
                >
                  {yearData.length > 10 ? String(d.year).slice(-2) : d.year}
                </div>
              ))}
            </div>
          </div>
        </div>

        {topAssignees.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-gray-600" />
              <h4 className="text-sm font-semibold text-gray-700">Top Assignees</h4>
            </div>
            <div className="space-y-2">
              {topAssignees.map((assignee, idx) => {
                const maxAssigneeCount = topAssignees[0]?.count || 1;
                const width = (assignee.count / maxAssigneeCount) * 100;
                return (
                  <div key={idx} className="group">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 truncate max-w-[200px]" title={assignee.name}>
                        {assignee.name}
                      </span>
                      <span className="text-gray-500 ml-2">{assignee.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full group-hover:bg-blue-600"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
