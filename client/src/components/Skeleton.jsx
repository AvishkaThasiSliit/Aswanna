import React from 'react';

export default function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="w-full">
      <div className="h-12 bg-slate-100 border-b border-border mb-2 rounded-t-card flex items-center px-4 gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`r-${i}`} className="h-16 border-b border-slate-100 flex items-center px-4 gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={`c-${i}-${j}`} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
