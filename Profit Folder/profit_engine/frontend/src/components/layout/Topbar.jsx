import React from 'react';
import { Bell } from 'lucide-react';

export default function Topbar({ isCalculating, apiOnline, lastUpdated }) {
  return (
    <header className="aswenna-topbar">
      <div className="topbar-subtitle">
        Smart Decisions for Better Harvests
      </div>

      <div className="topbar-right-actions">
        <div className={apiOnline ? "status-pill-online" : "status-pill-offline"}>
          <span className="status-pulse-dot" />
          <span>{isCalculating ? "Computing ML..." : (apiOnline ? "ML API Online" : "ML API Offline")}</span>
          <span style={{ opacity: 0.65, fontSize: '11px', marginLeft: 4 }}>
            Last updated: {lastUpdated}
          </span>
        </div>

        <button
          type="button"
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
          title="Notifications"
        >
          <Bell size={18} />
        </button>

        <div className="topbar-avatar" title="Farmer Profile">
          <span style={{ fontWeight: 700, fontSize: 13 }}>SL</span>
        </div>
      </div>
    </header>
  );
}
