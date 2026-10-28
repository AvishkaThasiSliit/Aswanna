import React from 'react';

export default function SectionCard({ number, title, children, className = '' }) {
  return (
    <section className={`bg-white rounded-card border border-border p-5 md:p-6 shadow-sm ${className}`}>
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
        {number && (
          <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
            {number}
          </span>
        )}
        <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
