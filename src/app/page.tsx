'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore, ViewType } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Wallet,
  CreditCard,
  AlertCircle,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Building2,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import DashboardView from '@/components/views/dashboard-view';
import ClientsView from '@/components/views/clients-view';
import BillsView from '@/components/views/bills-view';
import QuotationsView from '@/components/views/quotations-view';
import ExpensesView from '@/components/views/expenses-view';
import PaymentsView from '@/components/views/payments-view';
import DuesView from '@/components/views/dues-view';
import ChatPanel from '@/components/views/chat-panel';

interface Business {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface BusinessMenu {
  id: string;
  name: string;
  type: string;
  menus: { id: ViewType; label: string; labelBn: string; icon: React.ReactNode }[];
}

const BUSINESS_MENUS: Record<string, { id: ViewType; label: string; labelBn: string; icon: React.ReactNode }[]> = {
  'AAROHAN TECH SOLUTIONS': [
    { id: 'dashboard', label: 'Dashboard', labelBn: 'ড্যাশবোর্ড', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'clients', label: 'Clients', labelBn: 'ক্লায়েন্ট', icon: <Users className="h-4 w-4" /> },
    { id: 'bills', label: 'Bills', labelBn: 'বিল', icon: <FileText className="h-4 w-4" /> },
    { id: 'quotations', label: 'Quotations', labelBn: 'কোটেশন', icon: <Receipt className="h-4 w-4" /> },
    { id: 'expenses', label: 'Expenses', labelBn: 'খরচ', icon: <Wallet className="h-4 w-4" /> },
    { id: 'payments', label: 'Payments', labelBn: 'পেমেন্ট', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'dues', label: 'Dues', labelBn: 'বকেয়া', icon: <AlertCircle className="h-4 w-4" /> },
  ],
  default: [
    { id: 'dashboard', label: 'Dashboard', labelBn: 'ড্যাশবোর্ড', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'clients', label: 'Clients', labelBn: 'ক্লায়েন্ট', icon: <Users className="h-4 w-4" /> },
    { id: 'bills', label: 'Bills', labelBn: 'বিল', icon: <FileText className="h-4 w-4" /> },
    { id: 'quotations', label: 'Quotations', labelBn: 'কোটেশন', icon: <Receipt className="h-4 w-4" /> },
    { id: 'expenses', label: 'Expenses', labelBn: 'খরচ', icon: <Wallet className="h-4 w-4" /> },
    { id: 'payments', label: 'Payments', labelBn: 'পেমেন্ট', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'dues', label: 'Dues', labelBn: 'বকেয়া', icon: <AlertCircle className="h-4 w-4" /> },
  ],
};

export default function Home() {
  const { selectedBusinessId, selectedBusinessName, currentView, chatOpen, sidebarOpen, setSelectedBusiness, setCurrentView, toggleChat, setSidebarOpen } = useAppStore();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchBusinesses = useCallback(async () => {
    try {
      const res = await fetch('/api/business');
      const data = await res.json();
      setBusinesses(data);
      if (data.length > 0 && !selectedBusinessId) {
        setSelectedBusiness(data[0].id, data[0].name);
      }
    } catch (err) {
      console.error('Failed to fetch businesses:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBusinessId, setSelectedBusiness]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  const menuItems = selectedBusinessName ? (BUSINESS_MENUS[selectedBusinessName] || BUSINESS_MENUS.default) : [];

  const renderView = () => {
    if (!selectedBusinessId) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-500">Select a Business</h2>
            <p className="text-gray-400 mt-1">বাম পাশ থেকে বিজনেস সিলেক্ট করুন</p>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard': return <DashboardView businessId={selectedBusinessId} businessName={selectedBusinessName || ''} />;
      case 'clients': return <ClientsView businessId={selectedBusinessId} />;
      case 'bills': return <BillsView businessId={selectedBusinessId} />;
      case 'quotations': return <QuotationsView businessId={selectedBusinessId} />;
      case 'expenses': return <ExpensesView businessId={selectedBusinessId} businessName={selectedBusinessName || ''} />;
      case 'payments': return <PaymentsView businessId={selectedBusinessId} />;
      case 'dues': return <DuesView businessId={selectedBusinessId} />;
      default: return <DashboardView businessId={selectedBusinessId} businessName={selectedBusinessName || ''} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-10 w-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">লোড হচ্ছে... / Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* Desktop Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} hidden md:flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 shrink-0`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <h1 className="text-sm font-bold text-gray-900 truncate">AAROHAN HUB</h1>
                <p className="text-[10px] text-gray-400">Business Manager</p>
              </div>
            )}
          </div>
        </div>

        {/* Business List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {businesses.map((biz) => {
              const isActive = selectedBusinessId === biz.id;
              const menus = BUSINESS_MENUS[biz.name] || BUSINESS_MENUS.default;
              return (
                <div key={biz.id} className="mb-2">
                  <button
                    onClick={() => { setSelectedBusiness(biz.id, biz.name); setCurrentView('dashboard'); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isActive ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {biz.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    {sidebarOpen && (
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold truncate">{biz.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{biz.type}</p>
                      </div>
                    )}
                  </button>

                  {/* Sub-menus */}
                  {isActive && sidebarOpen && (
                    <div className="ml-4 mt-1 space-y-0.5">
                      {menus.map((menu) => (
                        <button
                          key={menu.id}
                          onClick={() => setCurrentView(menu.id)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all ${
                            currentView === menu.id
                              ? 'bg-emerald-100 text-emerald-700 font-medium'
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                          }`}
                        >
                          {menu.icon}
                          <span>{menu.labelBn}</span>
                          <span className="text-gray-300">/</span>
                          <span>{menu.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Sidebar toggle + Theme */}
        <div className="p-2 border-t border-gray-100 flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="flex-1 justify-center" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* Mobile header + drawer */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setMobileMenuOpen(true)} className="p-1">
          <Menu className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-sm font-bold text-gray-900">
          {selectedBusinessName || 'AAROHAN HUB'}
        </h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={toggleChat} className="p-1">
            <MessageSquare className="h-5 w-5 text-emerald-600" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold">AAROHAN HUB</h2>
              <button onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="p-2">
              {businesses.map((biz) => {
                const isActive = selectedBusinessId === biz.id;
                const menus = BUSINESS_MENUS[biz.name] || BUSINESS_MENUS.default;
                return (
                  <div key={biz.id} className="mb-2">
                    <button
                      onClick={() => { setSelectedBusiness(biz.id, biz.name); setCurrentView('dashboard'); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ${
                        isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600'
                      }`}
                    >
                      <div className={`h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold ${
                        isActive ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {biz.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{biz.name}</p>
                        <p className="text-[10px] text-gray-400">{biz.type}</p>
                      </div>
                    </button>
                    {isActive && (
                      <div className="ml-4 mt-1 space-y-0.5">
                        {menus.map((menu) => (
                          <button
                            key={menu.id}
                            onClick={() => { setCurrentView(menu.id); setMobileMenuOpen(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs ${
                              currentView === menu.id ? 'bg-emerald-100 text-emerald-700 font-medium' : 'text-gray-500'
                            }`}
                          >
                            {menu.icon}
                            <span>{menu.labelBn}</span>
                            <span className="text-gray-300">/</span>
                            <span>{menu.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="hidden md:flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">
              {menuItems.find(m => m.id === currentView)?.labelBn || 'ড্যাশবোর্ড'}
            </h2>
            <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
              {selectedBusinessName}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={toggleChat}
              className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI সহকারী
            </Button>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-auto pt-14 md:pt-0">
          {renderView()}
        </div>
      </main>

      {/* Chat Panel */}
      {chatOpen && selectedBusinessId && (
        <ChatPanel businessId={selectedBusinessId} businessName={selectedBusinessName || ''} />
      )}
    </div>
  );
}
