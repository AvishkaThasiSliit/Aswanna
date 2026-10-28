import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';

function CostChips({ expense, t }) {
  const chips = [];
  if (expense.inputs?.length > 0) chips.push({ label: t('categories.inputs'), color: 'bg-blue-50 text-blue-700 border-blue-200' });
  if (expense.machinery?.cost) chips.push({ label: t('categories.machinery'), color: 'bg-amber-50 text-amber-700 border-amber-200' });
  if (expense.labour?.cost) chips.push({ label: t('categories.labour'), color: 'bg-purple-50 text-purple-700 border-purple-200' });
  if (expense.other?.cost) chips.push({ label: t('categories.other'), color: 'bg-slate-100 text-slate-700 border-slate-200' });

  if (chips.length === 0) return <span className="text-slate-400">-</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c, i) => (
        <span key={i} className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${c.color}`}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

function ExpandableRow({ expense, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const activityName = lang === 'si' ? expense.activityCode?.nameSi : expense.activityCode?.nameEn;

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[40px]">
          <button 
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-slate-200 text-slate-500"
            title="Expand row"
          >
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
        
        <div className="flex-1 min-w-[100px] text-sm text-slate-600">
          {formatDate(expense.entryDate)}
        </div>
        
        <div className="flex-[2] min-w-[150px]">
          <div className="text-sm font-bold text-slate-900 truncate">
            {activityName || '-'}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {expense.activityCode?.code}
          </div>
        </div>

        <div className="flex-[2] min-w-[120px]">
          <CostChips expense={expense} t={t} />
        </div>

        <div className="flex-[2] min-w-[150px] text-sm text-slate-600 truncate">
          {expense.notes || '-'}
        </div>

        <div className="flex-1 min-w-[100px] font-bold text-slate-900 text-right sm:text-left">
          {formatCurrency(expense.totalAmount, lang)}
        </div>

        <div className="flex-1 min-w-[100px]">
          <StatusBadge status={expense.dayStatus} />
        </div>

        <div className="flex items-center justify-end gap-2 sm:min-w-[80px]">
          <Link 
            to={`/tracker/edit/${expense._id}`}
            className="p-1.5 text-slate-400 hover:text-primary hover:bg-tint rounded-control transition-colors"
            title={t('table.edit')}
          >
            <Edit2 size={16} />
          </Link>
          <button 
            onClick={() => onDelete(expense)}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-control transition-colors"
            title={t('table.delete')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="bg-slate-50 border-b border-slate-100 p-4 pl-12 text-sm text-slate-700 animate-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {expense.inputs?.length > 0 && (
              <div>
                <h4 className="font-bold mb-2">{t('categories.inputs')}</h4>
                <ul className="space-y-1">
                  {expense.inputs.map((inp, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{t(`categories.${inp.inputType}`)} ({inp.quantity} {inp.unit})</span>
                      <span className="font-medium">{formatCurrency(inp.cost, lang)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {expense.machinery?.cost > 0 && (
              <div>
                <h4 className="font-bold mb-2">{t('categories.machinery')}</h4>
                <div className="flex justify-between">
                  <span>{expense.machinery.method}</span>
                  <span className="font-medium">{formatCurrency(expense.machinery.cost, lang)}</span>
                </div>
              </div>
            )}

            {expense.labour?.cost > 0 && (
              <div>
                <h4 className="font-bold mb-2">{t('categories.labour')}</h4>
                <div className="flex justify-between text-slate-600 text-xs">
                  <span>Family: {expense.labour.familyLabour} | Hired: {expense.labour.hiredLabour} | Wage: {formatCurrency(expense.labour.dailyWage, lang)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Total Labour Cost</span>
                  <span className="font-medium">{formatCurrency(expense.labour.cost, lang)}</span>
                </div>
              </div>
            )}

            {expense.other?.cost > 0 && (
              <div>
                <h4 className="font-bold mb-2">{t('categories.other')}</h4>
                <div className="flex justify-between">
                  <span>{expense.other.description || '-'}</span>
                  <span className="font-medium">{formatCurrency(expense.other.cost, lang)}</span>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
            <span className="font-bold mr-4 text-slate-500">Day Total:</span>
            <span className="font-bold text-primary text-lg">{formatCurrency(expense.totalAmount, lang)}</span>
          </div>
        </div>
      )}
    </>
  );
}

export default function DataTable({ data, total, page, pageSize, onDelete }) {
  const { t } = useTranslation();

  if (!data || data.length === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="bg-white rounded-card border border-border overflow-hidden">
      <div className="hidden sm:flex bg-slate-50 border-b border-border px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider gap-4">
        <div className="w-10"></div>
        <div className="flex-1 min-w-[100px]">{t('table.date')}</div>
        <div className="flex-[2] min-w-[150px]">{t('table.activity')}</div>
        <div className="flex-[2] min-w-[120px]">{t('table.costTypes')}</div>
        <div className="flex-[2] min-w-[150px]">{t('table.description')}</div>
        <div className="flex-1 min-w-[100px]">{t('table.amount')}</div>
        <div className="flex-1 min-w-[100px]">{t('table.status')}</div>
        <div className="w-[80px] text-right">{t('table.actions')}</div>
      </div>
      
      <div className="flex flex-col">
        {data.map(expense => (
          <ExpandableRow key={expense._id} expense={expense} onDelete={onDelete} />
        ))}
      </div>

      <div className="bg-slate-50 px-6 py-4 border-t border-border flex items-center justify-between text-sm text-slate-600">
        <div>
          {t('table.pagination', { from, to, total })}
        </div>
      </div>
    </div>
  );
}
