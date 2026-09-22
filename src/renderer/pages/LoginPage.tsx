import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { t } from '../i18n';

export default function LoginPage() {
  const { language, setLanguage, setUser, setToken, setPermissions } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await window.electronAPI.login(username, password) as {
        token: string;
        user: { id: number; username: string; displayName: string; roleId: number };
        permissions: string[];
      };

      localStorage.setItem('authToken', result.token);
      setToken(result.token);
      setUser(result.user);
      setPermissions(result.permissions);
    } catch {
      setError(t('loginError', language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-slate-950">
      {/* Animated gradient blobs */}
      <div className="absolute inset-0">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-violet-600/30 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-fuchsia-600/30 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md p-8 bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 animate-pop-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-3xl shadow-glow-lg">
            🌸
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
            {t('appName', language)}
          </h1>
          <p className="text-white/50 text-sm mt-2">{t('welcomeMessage', language)}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-white/80">{t('username', language)}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400/60 transition-all duration-200"
              required
              autoFocus
              dir="rtl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-white/80">{t('password', language)}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400/60 transition-all duration-200"
              required
              dir="rtl"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm animate-pop-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white transition-all duration-300 hover:translate-y-[-1px] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            style={{ backgroundImage: 'linear-gradient(135deg, #8b5cf6, #d946ef)', boxShadow: '0 8px 30px -8px rgba(139,92,246,0.6)' }}
          >
            {loading ? t('loading', language) : t('login', language)}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="text-sm text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5"
          >
            {language === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>
      </div>
    </div>
  );
}