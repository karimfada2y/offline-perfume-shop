import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { t } from '../i18n';
import { formatCurrency, formatDate } from '../utils/lib';
import { DashboardData } from '../../shared/types';

const cardGradients: Record<string, { bg: string; glow: string }> = {
  'todaySales': { bg: 'bg-gradient-to-br from-blue-500 to-indigo-600', glow: 'shadow-[0_8px_30px_-8px_rgba(59,130,246,0.5)]' },
  'todayProfit': { bg: 'bg-gradient-to-br from-emerald-500 to-green-600', glow: 'shadow-[0_8px_30px_-8px_rgba(16,185,129,0.5)]' },
  'todayOrders': { bg: 'bg-gradient-to-br from-violet-500 to-purple-600', glow: 'shadow-[0_8px_30px_-8px_rgba(139,92,246,0.5)]' },
  'monthlySales': { bg: 'bg-gradient-to-br from-orange-500 to-amber-600', glow: 'shadow-[0_8px_30px_-8px_rgba(249,115,22,0.5)]' },
  'monthlyProfit': { bg: 'bg-gradient-to-br from-teal-500 to-cyan-600', glow: 'shadow-[0_8px_30px_-8px_rgba(20,184,166,0.5)]' },
  'customerDebt': { bg: 'bg-gradient-to-br from-rose-500 to-red-600', glow: 'shadow-[0_8px_30px_-8px_rgba(244,63,94,0.5)]' },
  'supplierDebt': { bg: 'bg-gradient-to-br from-amber-500 to-yellow-500', glow: 'shadow-[0_8px_30px_-8px_rgba(245,158,11,0.5)]' },
  'lowStockItems': { bg: 'bg-gradient-to-br from-fuchsia-500 to-pink-600', glow: 'shadow-[0_8px_30px_-8px_rgba(217,70,239,0.5)]' },
  'todayProduction': { bg: 'bg-gradient-to-br from-indigo-500 to-blue-600', glow: 'shadow-[0_8px_30px_-8px_rgba(99,102,241,0.5)]' },
  'productionCost': { bg: 'bg-gradient-to-br from-pink-500 to-rose-600', glow: 'shadow-[0_8px_30px_-8px_rgba(236,72,153,0.5)]' },
};

export default function Dashboard() {
  const { language } = useAuthStore();
  const { setCurrentPath } = useAppStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [guideDismissed, setGuideDismissed] = useState(() => localStorage.getItem('guideDismissed') === 'true');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const result = await window.electronAPI.getDashboard() as DashboardData;
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    { key: 'todaySales', label: t('todaySales', language), value: formatCurrency(data.todaySales), icon: '💰' },
    { key: 'todayProfit', label: t('todayProfit', language), value: formatCurrency(data.todayProfit), icon: '📈' },
    { key: 'todayOrders', label: t('todayOrders', language), value: data.todayOrders.toString(), icon: '📋' },
    { key: 'monthlySales', label: t('monthlySales', language), value: formatCurrency(data.monthSales), icon: '📊' },
    { key: 'monthlyProfit', label: t('monthlyProfit', language), value: formatCurrency(data.monthNetProfit), icon: '💹' },
    { key: 'customerDebt', label: t('customerDebt', language), value: formatCurrency(data.customerDebt), icon: '👥' },
    { key: 'supplierDebt', label: t('supplierDebt', language), value: formatCurrency(data.supplierDebt), icon: '🚚' },
    { key: 'lowStockItems', label: t('lowStockItems', language), value: data.lowStock.length.toString(), icon: '⚠️' },
  ];

  const productionCards = [
    { key: 'todayProduction', label: language === 'ar' ? 'إنتاج اليوم' : "Today's Production", value: (data.todayProduction || 0).toString(), icon: '⚗️' },
    { key: 'productionCost', label: language === 'ar' ? 'تكلفة الإنتاج' : 'Production Cost', value: formatCurrency(data.todayProductionCost || 0), icon: '🏭' },
  ];

  const renderStatCard = (card: { key: string; label: string; value: string; icon: string }, delay: number) => {
    const g = cardGradients[card.key] || cardGradients.todaySales;
    return (
      <div
        key={card.key}
        className={`p-5 rounded-2xl ${g.bg} text-white ${g.glow} transition-all duration-300 hover:scale-[1.02] hover:shadow-xl animate-slide-up`}
        style={{ animationDelay: `${delay}ms` }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl">
            {card.icon}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur-sm text-xs font-semibold">
            {card.label}
          </span>
        </div>
        <p className="text-2xl font-extrabold tracking-tight">{card.value}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">
          <span className="gradient-text">{t('dashboard', language)}</span>
        </h1>
        <span className="text-sm text-muted-foreground font-medium">
          {formatDate(new Date().toISOString())}
        </span>
      </div>

      {!guideDismissed && (
        <div className="card-modern p-4 flex items-center gap-3 bg-gradient-to-l from-violet-500/10 to-fuchsia-500/10 border-primary/20 animate-slide-up">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center text-lg shadow-glow">📖</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">
              {language === 'ar' ? 'جديد هنا؟' : 'New here?'}
            </p>
            <p className="text-xs text-muted-foreground">
              {language === 'ar'
                ? 'دليل الاستخدام يشرح كل شيء خطوة بخطوة: إضافة منتجات، البيع، الإنتاج والتقارير.'
                : 'The User Guide explains everything step by step: products, selling, production and reports.'}
            </p>
          </div>
          <button
            onClick={() => setCurrentPath('/help')}
            className="shrink-0 px-4 py-2 rounded-xl text-white text-sm font-semibold bg-gradient-to-l from-violet-500 to-fuchsia-500 hover:scale-105 transition-transform shadow-glow"
          >
            {t('userGuide', language)}
          </button>
          <button
            onClick={() => { localStorage.setItem('guideDismissed', 'true'); setGuideDismissed(true); }}
            className="shrink-0 w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            title={t('close', language)}
          >
            &times;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => renderStatCard(card, i * 40))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {productionCards.map((card, i) => renderStatCard(card, i * 40))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-modern p-5 hover:shadow-card-hover transition-shadow duration-300 animate-slide-up">
          <h3 className="font-bold mb-1 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center text-sm">🏆</span>
            {t('topProducts', language)}
          </h3>
          {data.topProducts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noData', language)}</p>
          ) : (
            <div className="space-y-2 mt-4">
              {data.topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-dashed border-border hover:bg-muted/40 transition-colors">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[10px] flex items-center justify-center font-bold">
                      {i + 1}
                    </span>
                    {p.product_name}
                  </span>
                  <div className="text-sm text-left">
                    <span className="font-bold text-primary">{p.total_qty}</span>
                    <span className="text-muted-foreground mr-2 text-xs">({formatCurrency(p.total_revenue)})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-modern p-5 hover:shadow-card-hover transition-shadow duration-300 animate-slide-up" style={{ animationDelay: '80ms' }}>
          <h3 className="font-bold mb-1 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-red-500 text-white flex items-center justify-center text-sm">📉</span>
            {t('lowStockItems', language)}
          </h3>
          {data.lowStock.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">✅ {t('noData', language)}</p>
          ) : (
            <div className="space-y-2 mt-4">
              {data.lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-dashed border-border hover:bg-muted/40 transition-colors">
                  <span className="text-sm font-medium">{p.nameAr}</span>
                  <span className="text-sm font-bold px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    {p.currentStock} / {p.minimumStock}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {data.cashSession && (
        <div className="card-modern p-5 flex items-center justify-between transition-shadow duration-300 hover:shadow-card-hover animate-slide-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-lg">💵</span>
            <div>
              <h3 className="font-bold">{t('cashStatus', language)}</h3>
              <p className="text-sm text-muted-foreground">{data.cashSession.register_name}</p>
            </div>
          </div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(data.cashSession.openingCash)}
          </div>
        </div>
      )}
    </div>
  );
}