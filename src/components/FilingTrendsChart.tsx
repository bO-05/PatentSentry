import { useMemo } from 'react';
import { BarChart3, Building2, TrendingUp, Calendar } from 'lucide-react';
import { PatentSearchResult } from '../types/patent';

interface FilingTrendsChartProps {
  patents: PatentSearchResult[];
}

export default function FilingTrendsChart({ patents }: FilingTrendsChartProps) {
  const { chartData, topAssignees, stats, timeRange } = useMemo(() => {
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

    // Get years with actual data (no empty gaps)
    const yearsWithData = Object.keys(yearCounts).map(Number).sort((a, b) => a - b);
    const minYear = yearsWithData[0] || new Date().getFullYear();
    const maxYear = yearsWithData[yearsWithData.length - 1] || new Date().getFullYear();

    // Smart grouping: If data spans > 20 years, group by decade
    // If data spans > 10 years, group by 5 years
    // Otherwise show individual years
    const span = maxYear - minYear;
    let groupedData: { label: string; count: number; years: number[] }[] = [];

    if (span > 25) {
      // Group by decade
      const decades: Record<string, { count: number; years: number[] }> = {};
      yearsWithData.forEach(year => {
        const decade = Math.floor(year / 10) * 10;
        const label = `${decade}s`;
        if (!decades[label]) decades[label] = { count: 0, years: [] };
        decades[label].count += yearCounts[year];
        decades[label].years.push(year);
      });
      groupedData = Object.entries(decades)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([label, data]) => ({ label, ...data }));
    } else if (span > 12) {
      // Group by 5-year periods
      const periods: Record<string, { count: number; years: number[] }> = {};
      yearsWithData.forEach(year => {
        const periodStart = Math.floor(year / 5) * 5;
        const label = `${periodStart}-${periodStart + 4}`;
        if (!periods[label]) periods[label] = { count: 0, years: [] };
        periods[label].count += yearCounts[year];
        periods[label].years.push(year);
      });
      groupedData = Object.entries(periods)
        .sort((a, b) => parseInt(a[0].split('-')[0]) - parseInt(b[0].split('-')[0]))
        .map(([label, data]) => ({ label: `'${label.slice(2, 4)}-'${label.slice(-2)}`, ...data }));
    } else {
      // Show individual years (only years with data, no empty gaps)
      groupedData = yearsWithData.map(year => ({
        label: span > 8 ? `'${String(year).slice(-2)}` : String(year),
        count: yearCounts[year],
        years: [year]
      }));
    }

    const maxCount = Math.max(...groupedData.map(d => d.count), 1);

    const sortedAssignees = Object.entries(assigneeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      chartData: groupedData.map(d => ({
        ...d,
        heightPercent: Math.round((d.count / maxCount) * 100)
      })),
      topAssignees: sortedAssignees,
      stats: {
        total: patents.length,
        active: activeCount,
        expired: expiredCount,
        avgPerYear: yearsWithData.length > 0
          ? Math.round(patents.length / yearsWithData.length * 10) / 10
          : 0,
      },
      timeRange: yearsWithData.length > 0
        ? { min: minYear, max: maxYear, span }
        : null,
    };
  }, [patents]);

  if (patents.length === 0) return null;

  const maxPatentCount = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Search Insights</h3>
        {timeRange && (
          <span className="ml-auto text-xs text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {timeRange.min} – {timeRange.max}
          </span>
        )}
      </div>

      {/* Stats Cards */}
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

      {/* Charts Section - Equal Height */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Filing Trends */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-700">Filing Trends</h4>
          </div>

          <div className="flex-1 flex flex-col justify-end min-h-[180px] bg-slate-50/50 rounded-lg p-4">
            {/* Y-axis labels */}
            <div className="flex gap-3 h-full">
              <div className="flex flex-col justify-between text-xs text-gray-400 py-1 w-6 text-right">
                <span>{maxPatentCount}</span>
                <span>{Math.round(maxPatentCount / 2)}</span>
                <span>0</span>
              </div>

              {/* Bars */}
              <div className="flex-1 flex items-end gap-1 border-l border-b border-gray-200 pl-2 pb-1 min-h-[120px]">
                {chartData.map((d, idx) => (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center justify-end group"
                    style={{ minWidth: chartData.length > 12 ? 16 : 28, maxWidth: 48 }}
                  >
                    {/* Bar */}
                    <div className="relative w-full flex justify-center">
                      <div
                        className="bg-blue-500 rounded-t-sm group-hover:bg-blue-600 transition-colors cursor-pointer"
                        style={{
                          height: Math.max(d.heightPercent * 1.2, d.count > 0 ? 8 : 0),
                          width: '70%',
                          maxWidth: 32,
                        }}
                      />
                      {/* Tooltip */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none shadow-lg">
                        {d.count} patent{d.count !== 1 ? 's' : ''}
                        {d.years.length > 1 && <span className="text-gray-400 ml-1">({d.years.length} yrs)</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* X-axis labels */}
            <div className="flex gap-1 mt-2 ml-9">
              {chartData.map((d, idx) => (
                <div
                  key={`label-${idx}`}
                  className="flex-1 text-center text-xs text-gray-500 truncate"
                  style={{ minWidth: chartData.length > 12 ? 16 : 28, maxWidth: 48 }}
                  title={d.years.join(', ')}
                >
                  {d.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Assignees */}
        {topAssignees.length > 0 && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-gray-600" />
              <h4 className="text-sm font-semibold text-gray-700">Top Assignees</h4>
            </div>
            <div className="flex-1 flex flex-col justify-center space-y-3 bg-slate-50/50 rounded-lg p-4 min-h-[180px]">
              {topAssignees.map((assignee, idx) => {
                const maxAssigneeCount = topAssignees[0]?.count || 1;
                const width = (assignee.count / maxAssigneeCount) * 100;
                return (
                  <div key={idx} className="group">
                    <div className="flex justify-between text-sm mb-1.5">
                      <span
                        className="text-gray-700 truncate font-medium"
                        style={{ maxWidth: 'calc(100% - 40px)' }}
                        title={assignee.name}
                      >
                        {assignee.name}
                      </span>
                      <span className="text-gray-500 font-semibold ml-2 tabular-nums">
                        {assignee.count}
                      </span>
                    </div>
                    <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full group-hover:from-blue-600 group-hover:to-blue-500 transition-colors"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {/* Fill empty space if fewer than 5 assignees */}
              {topAssignees.length < 5 && (
                <div className="flex-1" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
