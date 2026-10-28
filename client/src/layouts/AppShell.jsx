import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../utils/auth.jsx';
import { 
  Menu, X, ArrowLeft, HelpCircle, 
  LayoutDashboard, TrendingUp, Leaf, Activity,
  LineChart, FileText, History, Bell, Settings,
  LogOut, LifeBuoy, Sprout, Receipt, FileEdit, PieChart, Calendar, Mic
} from 'lucide-react';


export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { i18n, t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleLang = () => {
    const nextLang = i18n.language === 'en' ? 'si' : 'en';
    i18n.changeLanguage(nextLang);
    localStorage.setItem('aswanna_lang', nextLang);
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    { path: '/prediction', icon: TrendingUp, labelKey: 'nav.costPrediction' },
    { path: '/recommendation', icon: Leaf, labelKey: 'nav.cropRecommendation' },
    { path: '/simulation', icon: Activity, labelKey: 'nav.simulation' },
    ...(import.meta.env.VITE_VOICE_DATASET_COLLECTION === 'on' ? [{ path: '/dataset-collection', icon: Mic, labelKey: 'nav.voiceDataset', fallback: 'Voice Dataset' }] : []),
    { path: '/tracker', icon: LineChart, labelKey: 'nav.dailyCostTracker' },
    { path: '/reports', icon: FileText, labelKey: 'nav.reports' },
    { path: '/history', icon: History, labelKey: 'nav.history' },
    { path: '/alerts', icon: Bell, labelKey: 'nav.alerts' },
    { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
    { path: '/support', icon: LifeBuoy, labelKey: 'nav.helpSupport' },
  ];

  const trackerSubItems = [
    { path: '/tracker/records', icon: Receipt, labelKey: 'sections.records' },
    { path: '/tracker/harvest-sales', icon: Sprout, labelKey: 'nav.harvestSales' },
    { path: '/tracker/notes', icon: FileEdit, labelKey: 'nav.notes' },
    { path: '/tracker/summary', icon: PieChart, labelKey: 'nav.summary' },
    { path: '/tracker/calendar', icon: Calendar, labelKey: 'nav.calendar' },
  ];

  return (
    <div className="flex h-screen bg-page overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-primary text-white flex flex-col
        transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center px-6 gap-3 shrink-0">
          <Sprout size={24} className="text-emerald-400" />
          <span className="text-xl font-bold tracking-tight">
            {t('app.title')}
          </span>
          <button 
            className="ml-auto lg:hidden text-white/70 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin">
          {navItems.map((item) => (
            <React.Fragment key={item.path}>
              <NavLink
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-control font-medium transition-colors
                  ${isActive 
                    ? 'bg-navActive text-emerald-100' 
                    : 'text-emerald-50/70 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <item.icon size={20} />
                <span>{t(item.labelKey, item.fallback || '')}</span>
              </NavLink>
              {item.path === '/tracker' && (
                <div className="ml-5 pl-3 border-l border-emerald-500/30 space-y-1 my-1">
                  {trackerSubItems.map((sub) => (
                    <NavLink
                      key={sub.path}
                      to={sub.path}
                      id={`sidebar-${sub.path.replace(/\//g, '-')}`}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) => `
                        flex items-center gap-2.5 px-2.5 py-1.5 rounded-control text-xs font-medium transition-colors
                        ${isActive 
                          ? 'bg-navActive text-white font-bold' 
                          : 'text-emerald-50/70 hover:bg-white/10 hover:text-white'
                        }
                      `}
                    >
                      <sub.icon size={15} />
                      <span>{t(sub.labelKey)}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </nav>

        <div className="p-4 shrink-0">
          <button 
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-control font-medium text-emerald-50/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut size={20} />
            <span>{t('app.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 shrink-0 bg-white border-b border-border flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button 
              className="lg:hidden p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-control"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <button 
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-control hidden lg:block"
              onClick={() => navigate(-1)}
              title={t('app.back')}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                {t('app.title')}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {t('app.subtitle')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary bg-tint hover:bg-emerald-100 rounded-control transition-colors"
              onClick={() => alert(t('howItWorksModal.title'))}
            >
              <HelpCircle size={16} />
              <span className="hidden sm:inline">{t('app.howItWorks')}</span>
            </button>
            <button 
              onClick={toggleLang}
              className="px-3 py-1.5 text-sm font-bold text-slate-600 border border-border rounded-control hover:bg-slate-50 transition-colors uppercase w-14 text-center"
            >
              {i18n.language === 'en' ? 'සිං' : 'EN'}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
