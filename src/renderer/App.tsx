import React, { useEffect, useState } from 'react';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import SetupWizard from './pages/SetupWizard';
import LicenseActivation from './pages/LicenseActivation';
import MainLayout from './components/layout/MainLayout';
import '../shared/types/electron-api';

export default function App() {
  const { user, language, darkMode } = useAuthStore();
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);
  const [isLicensePage, setIsLicensePage] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    if (darkMode) {
      document.documentElement.classList.add('dark');
    }
  }, [language, darkMode]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#/license') {
      setIsLicensePage(true);
      setLoading(false);
      return;
    }

    if (hash === '#/setup') {
      setIsFirstRun(true);
      setLoading(false);
      return;
    }

    async function checkFirstRun() {
      try {
        const first = await window.electronAPI.isFirstRun();
        setIsFirstRun(first);
      } catch {
        setIsFirstRun(true);
      } finally {
        setLoading(false);
      }
    }
    checkFirstRun();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (isLicensePage) {
    return <LicenseActivation />;
  }

  if (isFirstRun) {
    return <SetupWizard onComplete={() => setIsFirstRun(false)} />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <MainLayout />;
}
