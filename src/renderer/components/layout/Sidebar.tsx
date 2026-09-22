import React, { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { t } from '../../i18n';

interface MenuItem {
  path: string;
  icon: string;
  label: string;
  perm: string;
  color: string;
}

interface MenuSection {
  key: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  accent: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    key: 'main',
    labelAr: 'الرئيسية',
    labelEn: 'Main',
    icon: '🏠',
    accent: 'from-indigo-500 to-violet-500',
    items: [
      { path: '/', icon: '📊', label: 'dashboard', perm: 'view_dashboard', color: 'from-indigo-500 to-blue-500' },
      { path: '/pos', icon: '🛒', label: 'pos', perm: 'create_sale', color: 'from-violet-500 to-fuchsia-500' },
    ],
  },
  {
    key: 'operations',
    labelAr: 'العمليات',
    labelEn: 'Operations',
    icon: '📋',
    accent: 'from-emerald-500 to-teal-500',
    items: [
      { path: '/sales', icon: '💰', label: 'sales', perm: 'view_sales', color: 'from-emerald-500 to-green-500' },
      { path: '/purchases', icon: '📦', label: 'purchases', perm: 'view_purchases', color: 'from-teal-500 to-cyan-500' },
      { path: '/cash', icon: '💵', label: 'cashRegister', perm: 'view_dashboard', color: 'from-lime-500 to-green-500' },
      { path: '/expenses', icon: '💸', label: 'expenses', perm: 'create_expense', color: 'from-orange-500 to-amber-500' },
    ],
  },
  {
    key: 'inventory',
    labelAr: 'المنتجات والمخزون',
    labelEn: 'Products & Inventory',
    icon: '📦',
    accent: 'from-fuchsia-500 to-pink-500',
    items: [
      { path: '/products', icon: '🧴', label: 'products', perm: 'view_products', color: 'from-rose-500 to-pink-500' },
      { path: '/categories', icon: '📂', label: 'categories', perm: 'view_products', color: 'from-pink-500 to-fuchsia-500' },
      { path: '/inventory', icon: '🏭', label: 'inventory', perm: 'view_inventory', color: 'from-amber-500 to-orange-500' },
      { path: '/production', icon: '⚗️', label: 'production', perm: 'produce_batch', color: 'from-purple-500 to-violet-500' },
    ],
  },
  {
    key: 'contacts',
    labelAr: 'جهات الاتصال',
    labelEn: 'Contacts',
    icon: '👥',
    accent: 'from-sky-500 to-blue-500',
    items: [
      { path: '/customers', icon: '👤', label: 'customers', perm: 'view_customers', color: 'from-sky-500 to-indigo-500' },
      { path: '/suppliers', icon: '🚚', label: 'suppliers', perm: 'view_suppliers', color: 'from-blue-500 to-indigo-500' },
    ],
  },
  {
    key: 'reports',
    labelAr: 'التقارير',
    labelEn: 'Reports',
    icon: '📈',
    accent: 'from-yellow-500 to-amber-500',
    items: [
      { path: '/reports', icon: '📈', label: 'reports', perm: 'view_reports', color: 'from-yellow-500 to-amber-500' },
    ],
  },
  {
    key: 'system',
    labelAr: 'النظام',
    labelEn: 'System',
    icon: '⚙️',
    accent: 'from-slate-500 to-gray-500',
    items: [
      { path: '/help', icon: '📖', label: 'userGuide', perm: 'view_dashboard', color: 'from-violet-500 to-fuchsia-500' },
      { path: '/users', icon: '👤', label: 'employees', perm: 'manage_users', color: 'from-slate-400 to-gray-400' },
      { path: '/settings', icon: '⚙️', label: 'settings', perm: 'manage_settings', color: 'from-slate-500 to-zinc-500' },
      { path: '/audit', icon: '📝', label: 'auditLog', perm: 'manage_settings', color: 'from-zinc-400 to-slate-400' },
      { path: '/diagnostics', icon: '🔧', label: 'diagnostics', perm: 'manage_settings', color: 'from-slate-600 to-gray-600' },
    ],
  },
];

export default function Sidebar() {
  const { sidebarOpen, currentPath, setCurrentPath, toggleSidebar } = useAppStore();
  const { language, hasPermission } = useAuthStore();
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isSectionActive = (items: MenuItem[]) => items.some(i => i.path === currentPath);

  return (
    <aside
      className={`fixed top-0 right-0 h-screen bg-gradient-to-b from-slate-900 via-[#171626] to-slate-900 text-sidebar-foreground border-l border-sidebar-border transition-all duration-300 z-30 flex flex-col ${
        sidebarOpen ? 'w-64' : 'w-16'
      }`}
    >
      {/* Brand */}
      <div className="flex items-center justify-between px-4 h-16 shrink-0 bg-black/20 backdrop-blur border-b border-white/5">
        {sidebarOpen ? (
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold shadow-glow">
              ع
            </span>
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 truncate">
              {t('appName', language)}
            </span>
          </div>
        ) : (
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold shadow-glow mx-auto">
            ع
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white shrink-0"
          title={sidebarOpen ? '‹' : '›'}
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
      </div>

      {/* Nav */}
      <nav className="mt-2 px-2 overflow-y-auto scrollbar-thin flex-1" style={{ height: 'calc(100% - 64px)' }}>
        {(sidebarOpen ? menuSections : menuSections.filter(() => true)).map((section) => {
          const visibleItems = section.items.filter(i => hasPermission(i.perm));
          if (visibleItems.length === 0) return null;

          const isCollapsed = collapsedSections.has(section.key);
          const isActive = isSectionActive(visibleItems);

          return (
            <div key={section.key} className="mb-1.5">
              {sidebarOpen ? (
                <button
                  onClick={() => toggleSection(section.key)}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    isActive
                      ? 'text-white'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${section.accent} ${isActive ? 'opacity-100' : 'opacity-50'}`} />
                  <span className="flex-1 text-right">{language === 'ar' ? section.labelAr : section.labelEn}</span>
                  <span className="text-[9px] text-white/30">{isCollapsed ? '▲' : '▼'}</span>
                </button>
              ) : (
                <div className="mx-3 my-2 h-px bg-white/10" />
              )}

              {(!isCollapsed || !sidebarOpen) && (
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isItemActive = currentPath === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => setCurrentPath(item.path)}
                        className={`relative w-full flex items-center gap-3 px-3 py-2.5 mb-0.5 rounded-xl transition-all duration-200 text-sm font-medium ${
                          isItemActive
                            ? 'bg-gradient-to-l from-white/12 to-white/5 text-white shadow-inner'
                            : 'hover:bg-white/5 text-white/60 hover:text-white/90'
                        }`}
                        title={!sidebarOpen ? t(item.label, language) : undefined}
                      >
                        {isItemActive && (
                          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-full bg-gradient-to-b from-violet-400 to-fuchsia-400 shadow-glow" />
                        )}
                        <span className={`w-7 h-7 shrink-0 rounded-lg bg-gradient-to-br ${item.color} ${
                          isItemActive ? 'shadow-glow' : 'opacity-80'
                        } flex items-center justify-center text-[13px]`}>
                          {item.icon}
                        </span>
                        {sidebarOpen && (
                          <span className="truncate">{t(item.label, language)}</span>
                        )}
                        {sidebarOpen && isItemActive && (
                          <span className="absolute left-3 w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}