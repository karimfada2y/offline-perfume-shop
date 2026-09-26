import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAppStore } from '../../stores/appStore';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import Dashboard from '../../pages/Dashboard';
import POSPage from '../../pages/POSPage';
import ProductsPage from '../../pages/ProductsPage';
import CustomersPage from '../../pages/CustomersPage';
import SuppliersPage from '../../pages/SuppliersPage';
import PurchasesPage from '../../pages/PurchasesPage';
import SalesPage from '../../pages/SalesPage';
import InventoryPage from '../../pages/InventoryPage';
import ExpensesPage from '../../pages/ExpensesPage';
import CashRegisterPage from '../../pages/CashRegisterPage';
import ProductionPage from '../../pages/ProductionPage';
import ReportsPage from '../../pages/ReportsPage';
import SettingsPage from '../../pages/SettingsPage';
import UsersPage from '../../pages/UsersPage';
import AuditPage from '../../pages/AuditPage';
import DiagnosticsPage from '../../pages/DiagnosticsPage';
import CategoriesPage from '../../pages/CategoriesPage';
import HelpPage from '../../pages/HelpPage';
import UpdateBanner from '../UpdateBanner';

export default function MainLayout() {
  const { sidebarOpen } = useAppStore();
  const { currentPath } = useAppStore();

  const renderPage = () => {
    switch (currentPath) {
      case '/': return <Dashboard />;
      case '/pos': return <POSPage />;
      case '/products': return <ProductsPage />;
      case '/categories': return <CategoriesPage />;
      case '/customers': return <CustomersPage />;
      case '/suppliers': return <SuppliersPage />;
      case '/purchases': return <PurchasesPage />;
      case '/sales': return <SalesPage />;
      case '/inventory': return <InventoryPage />;
      case '/expenses': return <ExpensesPage />;
      case '/cash': return <CashRegisterPage />;
      case '/production': return <ProductionPage />;
      case '/reports': return <ReportsPage />;
      case '/settings': return <SettingsPage />;
      case '/users': return <UsersPage />;
      case '/audit': return <AuditPage />;
      case '/diagnostics': return <DiagnosticsPage />;
      case '/help': return <HelpPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>
      <Sidebar />
      <div className={`relative z-10 flex flex-col flex-1 transition-all duration-300 ${sidebarOpen ? 'mr-64' : 'mr-16'}`}>
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          {renderPage()}
        </main>
      </div>
      <UpdateBanner />
    </div>
  );
}
