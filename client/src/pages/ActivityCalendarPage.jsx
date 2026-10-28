import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api.js';
import SectionCard from '../components/SectionCard.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { Calendar, ChevronRight, X, ExternalLink, CalendarDays, Info } from 'lucide-react';

export default function ActivityCalendarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedDayInfo, setSelectedDayInfo] = useState(null);

  // 1. Fetch active cycle
  const { data: cyclesData, isLoading: isCyclesLoading } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => apiFetch('/cycles'),
  });

  const activeCycle = useMemo(() => {
    if (!cyclesData) return null;
    const items = cyclesData.items || cyclesData;
    if (Array.isArray(items)) {
      return items.find(c => c.status === 'active' || c.status === 'harvesting') || items.find(c => c.status === 'closed') || null;
    }
    return null;
  }, [cyclesData]);

  const cycleId = activeCycle?._id;

  // 2. Fetch Activity Calendar data
  const { data: calData, isLoading: isCalLoading } = useQuery({
    queryKey: ['activityCalendar', cycleId],
    queryFn: () => apiFetch(`/cycles/${cycleId}/calendar`),
    enabled: Boolean(cycleId),
  });

  const months = calData?.months || [];
  const calendar = calData?.calendar || {};
  const dayDetails = calData?.dayDetails || {};

  const handleDayClick = (year, month, day, isInvalid) => {
    if (isInvalid) return;
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const info = dayDetails[dateKey] || {
      date: dateKey,
      year,
      month,
      day,
      activityCodes: (calendar[year]?.[month]?.[day]) || [],
      expenses: [],
      hasNoWork: (calendar[year]?.[month]?.[day] || []).includes('NW'),
    };
    setSelectedDayInfo(info);
  };

  return (
    <div className="space-y-6 pb-12" id="activity-calendar-page">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t('activityCalendar.title', 'Activity Calendar')}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {t('activityCalendar.subtitle', 'Month-by-day activity codes and worked status generated from daily expense records')}
        </p>
      </div>

      {/* Legend & Summary Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white border border-border rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-400 inline-block" />
            <span className="text-slate-700 font-medium">{t('activityCalendar.legendWorked', 'Activity Recorded')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold flex items-center justify-center">
              NW
            </span>
            <span className="text-slate-700 font-medium">{t('activityCalendar.legendNoWork', 'No Work')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300 inline-block" />
            <span className="text-slate-500 font-medium">{t('activityCalendar.legendInvalid', 'Invalid Day (e.g. 31 June)')}</span>
          </div>
        </div>
        <div className="text-xs text-slate-400 italic">
          Generated automatically from daily expenses
        </div>
      </div>

      {/* ─── SECTION 1: SEASON ACTIVITY CALENDAR GRID ─────────────────────────── */}
      <SectionCard
        number="1"
        title={t('activityCalendar.sectionTitle', 'Season Activity Calendar (කන්නය තුල සිදු කළ ක්‍රියාකාරකම් දින දර්ශනය)')}
      >
        <div className="overflow-x-auto border border-border rounded-xl bg-white shadow-xs">
          <table className="min-w-[900px] w-full text-center border-collapse text-xs" id="activity-calendar-table">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-border">
                <th className="p-2.5 text-left font-bold w-24 sticky left-0 bg-slate-100 z-10 border-r border-border">
                  {t('activityCalendar.month', 'Month')}
                </th>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <th key={d} className="p-1.5 font-bold min-w-[28px] border-r border-border last:border-r-0">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {months.length === 0 ? (
                <tr>
                  <td colSpan={32} className="p-8 text-slate-400">
                    {isCalLoading ? 'Loading calendar...' : 'No cycle data available.'}
                  </td>
                </tr>
              ) : (
                months.map((m) => {
                  const daysInMonth = m.daysInMonth;
                  return (
                    <tr key={`${m.year}-${m.month}`} className="hover:bg-slate-50/50">
                      {/* Month label */}
                      <td className="p-2.5 text-left font-bold text-slate-800 sticky left-0 bg-white z-10 border-r border-border whitespace-nowrap">
                        <div className="flex items-center justify-between">
                          <span>{m.monthName}</span>
                          <span className="text-[10px] text-slate-400 font-normal ml-1">
                            {m.year}
                          </span>
                        </div>
                      </td>

                      {/* Days 1 to 31 */}
                      {Array.from({ length: 31 }, (_, idx) => {
                        const day = idx + 1;
                        const isInvalid = day > daysInMonth;
                        const codes = calendar[m.year]?.[m.month]?.[day] || [];
                        const hasCodes = codes.length > 0;
                        const hasNoWork = codes.includes('NW');

                        if (isInvalid) {
                          return (
                            <td
                              key={day}
                              className="p-1 bg-slate-200/70 border-r border-border last:border-r-0 select-none cursor-not-allowed"
                              title="Invalid day"
                            >
                              <span className="text-slate-400 text-[10px] font-mono">—</span>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={day}
                            className="p-0 border-r border-border last:border-r-0"
                          >
                            <button
                              type="button"
                              data-testid={`cal-day-btn-${m.year}-${m.month}-${day}`}
                              onClick={() => handleDayClick(m.year, m.month, day, false)}
                              className={`w-full min-h-[28px] p-1 flex flex-col items-center justify-center transition-colors select-none ${
                                hasCodes
                                  ? hasNoWork
                                    ? 'bg-amber-100 hover:bg-amber-200 font-bold text-amber-900'
                                    : 'bg-emerald-100 hover:bg-emerald-200 font-bold text-emerald-900'
                                  : 'hover:bg-slate-100 text-slate-400'
                              }`}
                              title={
                                hasCodes
                                  ? `Day ${day}: ${codes.join(', ')}`
                                  : `Day ${day}: No activities`
                              }
                            >
                              {hasCodes ? (
                                <span className="text-[11px] leading-tight font-extrabold">
                                  {codes.length <= 2 ? codes.join(',') : `${codes[0]}+`}
                                </span>
                              ) : (
                                <span className="text-[10px] opacity-40">{day}</span>
                              )}
                            </button>
                          </td>
                        );
                      }) }
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ─── Day Details Modal / Drawer ─────────────────────────── */}
      {selectedDayInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          onClick={() => setSelectedDayInfo(null)}
        >
          <div
            className="bg-white rounded-card shadow-xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            id="day-expenses-modal"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <CalendarDays size={20} className="text-primary" />
                <h3 className="text-base font-bold text-slate-900">
                  {t('activityCalendar.dayExpensesTitle', 'Expenses for')} {selectedDayInfo.date}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayInfo(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-control hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Activity Codes:</span>
                {selectedDayInfo.activityCodes.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">None</span>
                ) : (
                  selectedDayInfo.activityCodes.map((c, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300"
                    >
                      {c}
                    </span>
                  ))
                )}
                {selectedDayInfo.hasNoWork && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    {t('activityCalendar.noWorkDay', 'No-Work Day')}
                  </span>
                )}
              </div>

              {selectedDayInfo.expenses && selectedDayInfo.expenses.length > 0 ? (
                <div className="space-y-2 mt-3 max-h-60 overflow-y-auto pr-1">
                  {selectedDayInfo.expenses.map((exp) => (
                    <div
                      key={exp._id}
                      className="p-3 bg-slate-50 border border-border rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-800">
                          {exp.activityCode} {exp.activityName ? `• ${exp.activityName}` : ''}
                        </div>
                        <div className="text-slate-500 text-[11px] capitalize">
                          Status: {exp.dayStatus}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-slate-900 block">
                          {formatCurrency(exp.totalAmount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-4 text-center">
                  {t('activityCalendar.noExpensesOnDay', 'No expenses recorded on this day.')}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedDayInfo(null);
                  navigate('/tracker/records');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                <span>{t('activityCalendar.viewRecords', 'View in Expense Records')}</span>
                <ExternalLink size={12} />
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayInfo(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-control"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
