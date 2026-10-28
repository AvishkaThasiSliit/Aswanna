import {
  LayoutDashboard,
  Calculator,
  Sprout,
  BarChart3,
  Truck,
  Sparkles,
  Settings,
  BrainCircuit
} from 'lucide-react';
import aswennaLogoWhite from '../../images/aswenna-logo-white.png';

export default function Sidebar({ activeTab, onSelectTab }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'calculator', label: 'Farmer Profit Calculator', icon: Calculator },
    { id: 'cost', label: 'Cultivation Cost Estimator', icon: Sprout },
    { id: 'price', label: 'Market Prices', icon: BarChart3 },
    { id: 'models', label: 'AI Model Registry', icon: BrainCircuit },
    { id: 'logistics', label: 'Logistics & Centres', icon: Truck },
    { id: 'advisory', label: 'Advisory & Insights', icon: Sparkles },
    { id: 'settings', label: 'Profile & Settings', icon: Settings }
  ];

  return (
    <aside className="aswenna-sidebar">
      <div className="sidebar-brand-box">
        <div className="sidebar-brand-logo-wrap">
          <img
            src={aswennaLogoWhite}
            alt="Aswenna (අස්වැන්න)"
            className="sidebar-brand-white-logo"
          />
        </div>
      </div>

      <nav className="sidebar-nav-list">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <p>Aswenna Agricultural DSS • v2.1</p>
        <p style={{ opacity: 0.6, marginTop: 4 }}>Department of Agriculture & CBSL</p>
      </div>
    </aside>
  );
}
