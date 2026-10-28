import React from 'react';
import { useTranslation } from 'react-i18next';

const STATUS_STYLES = {
  recorded: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  pending: 'bg-amber-50 text-amber-800 border-amber-300',
  no_work: 'bg-slate-100 text-slate-700 border-slate-300',
  attention: 'bg-orange-50 text-orange-800 border-orange-300',
  significant: 'bg-rose-50 text-rose-800 border-rose-300',
};

export default function StatusBadge({ status = 'recorded' }) {
  const { t } = useTranslation();
  const style = STATUS_STYLES[status] || STATUS_STYLES.recorded;
  const label = t(`statuses.${status}`, status);

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-75"></span>
      {label}
    </span>
  );
}
