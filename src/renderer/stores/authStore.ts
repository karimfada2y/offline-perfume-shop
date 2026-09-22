import { create } from 'zustand';
import { Language } from '../i18n';

interface User {
  id: number;
  username: string;
  displayName: string;
  roleId: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  permissions: string[];
  language: Language;
  darkMode: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setPermissions: (permissions: string[]) => void;
  setLanguage: (lang: Language) => void;
  setDarkMode: (dark: boolean) => void;
  hasPermission: (perm: string) => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  permissions: [],
  language: (localStorage.getItem('language') as Language) || 'ar',
  darkMode: localStorage.getItem('darkMode') === 'true',
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setPermissions: (permissions) => set({ permissions }),
  setLanguage: (lang) => {
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    set({ language: lang });
  },
  setDarkMode: (dark) => {
    localStorage.setItem('darkMode', String(dark));
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ darkMode: dark });
  },
  hasPermission: (perm: string) => {
    const { permissions, user } = get();
    if (user?.roleId === 1) return true;
    return permissions.includes(perm);
  },
  logout: () => {
    localStorage.removeItem('authToken');
    set({ user: null, token: null, permissions: [] });
  },
}));
