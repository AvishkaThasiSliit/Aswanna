import React from 'react';
import { SearchX } from 'lucide-react';

export default function EmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-border rounded-card bg-slate-50/50">
      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-400 mb-4 shadow-sm">
        <SearchX size={32} />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-1">
        {title}
      </h3>
      <p className="text-sm text-slate-500 max-w-sm">
        {description}
      </p>
    </div>
  );
}
