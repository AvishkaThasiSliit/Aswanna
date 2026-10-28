import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter, X } from 'lucide-react';

export default function FilterBar({ filters, setFilters, onClear }) {
  const { t } = useTranslation();

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const hasActiveFilters = Object.values(filters).some(val => val !== '' && val !== 1);

  return (
    <div className="bg-white p-4 rounded-card border border-border mb-6 flex flex-col md:flex-row gap-4 items-center">
      <div className="relative flex-1 w-full">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={filters.search || ''}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          placeholder={t('filters.search')}
          className="w-full pl-10 pr-4 py-2.5 rounded-control border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm transition-shadow"
        />
      </div>

      <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
        <select
          value={filters.category || ''}
          onChange={(e) => handleFilterChange('category', e.target.value)}
          className="px-3 py-2.5 rounded-control border border-border text-sm outline-none focus:border-primary shrink-0 bg-white"
        >
          <option value="">{t('categories.all')}</option>
          <option value="inputs">{t('categories.inputs')}</option>
          <option value="machinery">{t('categories.machinery')}</option>
          <option value="labour">{t('categories.labour')}</option>
          <option value="other">{t('categories.other')}</option>
        </select>

        <input
          type="date"
          value={filters.startDate || ''}
          onChange={(e) => handleFilterChange('startDate', e.target.value)}
          className="px-3 py-2.5 rounded-control border border-border text-sm outline-none focus:border-primary shrink-0"
        />
        <span className="text-slate-400">-</span>
        <input
          type="date"
          value={filters.endDate || ''}
          onChange={(e) => handleFilterChange('endDate', e.target.value)}
          className="px-3 py-2.5 rounded-control border border-border text-sm outline-none focus:border-primary shrink-0"
        />

        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800 shrink-0 ml-2"
          >
            <X size={16} />
            <span className="hidden sm:inline">{t('filters.clear')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
