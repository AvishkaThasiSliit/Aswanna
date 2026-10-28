import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function WarningBanner({ warnings = [], onDismiss = null }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(new Set());

  if (!warnings || warnings.length === 0) return null;

  const activeWarnings = warnings.filter((_, idx) => !dismissed.has(idx));
  if (activeWarnings.length === 0) return null;

  const handleDismiss = (idx) => {
    setDismissed((prev) => new Set([...prev, idx]));
    if (onDismiss) onDismiss(idx);
  };

  return (
    <div className="space-y-2 mb-4" role="region" aria-label="Validation Warnings">
      {warnings.map((warn, idx) => {
        if (dismissed.has(idx)) return null;
        const msg = warn.key ? t(warn.key, warn.message) : warn.message;

        return (
          <div
            key={idx}
            className="flex items-start justify-between gap-3 p-3 bg-amber-50 border border-amber-300 rounded-control text-amber-900 text-xs sm:text-sm shadow-sm transition-all"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold">{t('common.warning', 'Warning')}:</span>{' '}
                <span>{msg}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDismiss(idx)}
              aria-label={t('common.dismiss', 'Dismiss warning')}
              className="text-amber-700 hover:text-amber-900 p-1 rounded hover:bg-amber-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
