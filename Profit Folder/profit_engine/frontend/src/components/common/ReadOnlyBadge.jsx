import React from 'react';
import { Lock } from 'lucide-react';

export default function ReadOnlyBadge({
  label,
  value,
  subtext = 'Live Market Data',
  tooltip = 'Provided by live market data. Cannot be edited.',
  icon: CustomIcon
}) {
  return (
    <div className="readonly-market-badge" title={tooltip}>
      <div className="badge-lock-icon">
        {CustomIcon ? <CustomIcon size={14} /> : <Lock size={14} />}
      </div>
      <div className="badge-content">
        <span className="badge-label">{label}</span>
        <span className="badge-value">{value}</span>
      </div>
      <span className="badge-tag">Locked</span>
    </div>
  );
}
