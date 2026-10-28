import React from 'react';

export default function KpiTile({ title, value, icon: Icon, subtext, highlight = false }) {
  return (
    <div className={`p-4 md:p-5 rounded-card border transition-all ${
      highlight ? 'bg-tint/60 border-primary/30' : 'bg-white border-border'
    } shadow-sm flex flex-col justify-between`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs md:text-sm font-medium text-slate-600">
          {title}
        </span>
        {Icon && (
          <div className="p-2 rounded-control bg-tint text-primary shrink-0">
            <Icon size={18} />
          </div>
        )}
      </div>
      <div>
        <div className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
          {value}
        </div>
        {subtext && (
          <div className="text-xs text-slate-500 mt-1">
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}
