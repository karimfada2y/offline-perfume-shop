import React from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAppStore } from '../../stores/appStore';
import { t } from '../../i18n';

export default function TopBar() {
  const { user, language, setLanguage, logout } = useAuthStore();
  const { notifications, removeNotification, setCurrentPath } = useAppStore();

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500/20 flex items-center justify-center overflow-hidden relative">
            <span className="text-sm text-white font-bold">👤</span>
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{user?.displayName}</span>
            <span className="text-[11px] text-muted-foreground">{user?.username}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentPath('/help')}
          title={t('userGuide', language)}
          className="w-9 h-9 rounded-xl border border-border bg-card hover:bg-violet-500 hover:text-white hover:border-violet-500 transition-all duration-200 font-bold text-sm"
        >
          ?
        </button>

        <button
          onClick={toggleLanguage}
          className="px-3.5 py-2 text-sm rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-primary/40 transition-all duration-200 font-medium"
        >
          {language === 'ar' ? 'EN' : 'عربي'}
        </button>

        <button
          onClick={logout}
          className="px-3.5 py-2 text-sm rounded-xl text-white font-semibold transition-all duration-200 hover:translate-y-[-1px]"
          style={{ backgroundImage: 'linear-gradient(135deg, #ef4444, #f97316)' }}
        >
          {t('logout', language)}
        </button>
      </div>

      {notifications.length > 0 && (
        <div className="fixed top-20 left-4 z-50 space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3.5 pr-4 pl-3 rounded-xl shadow-lg max-w-sm animate-pop-in ${
                n.type === 'success' ? 'bg-gradient-to-l from-green-500 to-emerald-500 text-white' :
                n.type === 'error' ? 'bg-gradient-to-l from-red-500 to-rose-500 text-white' :
                n.type === 'warning' ? 'bg-gradient-to-l from-amber-500 to-yellow-500 text-white' :
                'bg-gradient-to-l from-violet-500 to-fuchsia-500 text-white'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{n.message}</span>
                <button onClick={() => removeNotification(n.id)} className="text-lg leading-none opacity-80 hover:opacity-100 transition-opacity shrink-0">
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}