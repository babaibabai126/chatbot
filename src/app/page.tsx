'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore, ViewType } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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
  Rocket,
  GraduationCap,
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

const AAROHAN_MENUS: { id: ViewType; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'clients', label: 'Clients', icon: <Users className="h-4 w-4" /> },
  { id: 'bills', label: 'Bills', icon: <FileText className="h-4 w-4" /> },
  { id: 'quotations', label: 'Quotations', icon: <Receipt className="h-4 w-4" /> },
  { id: 'expenses', label: 'Expenses', icon: <Wallet className="h-4 w-4" /> },
  { id: 'payments', label: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'dues', label: 'Dues', icon: <AlertCircle className="h-4 w-4" /> },
];

function hasSubMenus(businessName: string): boolean {
  return businessName === 'AAROHAN TECH SOLUTIONS';
}
function isBlueTheme(businessName: string): boolean {
  return businessName === 'AAROHAN TECH SOLUTIONS';
}

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

  const blueTheme = isBlueTheme(selectedBusinessName || '');
  const showSubMenus = hasSubMenus(selectedBusinessName || '');
  const menuItems = showSubMenus ? AAROHAN_MENUS : [];

  const renderView = () => {
    if (!selectedBusinessId) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-500 dark:text-gray-400">Select a Business</h2>
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

  const getBusinessIcon = (name: string) => {
    if (name === 'ASTRONAUT STIKERZ') return <Rocket className="h-3 w-3" />;
    if (name === 'AAROHAN WEB ACADEMY') return <GraduationCap className="h-3 w-3" />;
    return null;
  };

  const getBusinessColors = (name: string, isActive: boolean) => {
    if (name === 'AAROHAN TECH SOLUTIONS') {
      return isActive
        ? { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-400', icon: 'bg-blue-600 text-white' }
        : { bg: '', text: 'text-gray-600 dark:text-gray-400', icon: 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400' };
    }
    if (name === 'ASTRONAUT STIKERZ') {
      return isActive
        ? { bg: 'bg-purple-50 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-400', icon: 'bg-purple-600 text-white' }
        : { bg: '', text: 'text-gray-600 dark:text-gray-400', icon: 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400' };
    }
    if (name === 'AAROHAN WEB ACADEMY') {
      return isActive
        ? { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400', icon: 'bg-amber-600 text-white' }
        : { bg: '', text: 'text-gray-600 dark:text-gray-400', icon: 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400' };
    }
    return isActive
      ? { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', icon: 'bg-gray-600 text-white' }
      : { bg: '', text: 'text-gray-600 dark:text-gray-400', icon: 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400' };
  };

  const getSubMenuActiveColor = (name: string) => {
    if (name === 'AAROHAN TECH SOLUTIONS') return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300';
    return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
  };

  const getSubMenuHoverColor = (name: string) => {
    if (name === 'AAROHAN TECH SOLUTIONS') return 'hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-700 dark:hover:text-blue-300';
    return 'hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className={`h-10 w-10 border-3 ${blueTheme ? 'border-blue-500' : 'border-emerald-500'} border-t-transparent rounded-full animate-spin mx-auto mb-4`} />
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* Desktop Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} hidden md:flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 shrink-0`}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg ${blueTheme ? 'bg-blue-600' : 'bg-emerald-600'} flex items-center justify-center shrink-0 transition-colors duration-300`}>
              <Building2 className="h-4 w-4 text-white" />
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">AAROHAN HUB</h1>
                <p className="text-[10px] text-gray-400">Business Manager</p>
              </div>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {businesses.map((biz) => {
              const isActive = selectedBusinessId === biz.id;
              const colors = getBusinessColors(biz.name, isActive);
              const bizIcon = getBusinessIcon(biz.name);
              const showMenu = isActive && hasSubMenus(biz.name) && sidebarOpen;

              return (
                <div key={biz.id} className="mb-2">
                  <button
                    onClick={() => { setSelectedBusiness(biz.id, biz.name); setCurrentView('dashboard'); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all ${colors.bg} ${colors.text}`}
                  >
                    <div className={`h-7 w-7 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${colors.icon}`}>
                      {bizIcon || biz.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    {sidebarOpen && (
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold truncate">{biz.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{biz.type}</p>
                      </div>
                    )}
                  </button>

                  {showMenu && (
                    <div className="ml-4 mt-1 space-y-0.5">
                      {AAROHAN_MENUS.map((menu) => (
                        <button
                          key={menu.id}
                          onClick={() => setCurrentView(menu.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-all ${
                            currentView === menu.id
                              ? `${getSubMenuActiveColor(biz.name)} font-medium`
                              : `text-gray-500 dark:text-gray-400 ${getSubMenuHoverColor(biz.name)}`
                          }`}
                        >
                          {menu.icon}
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

        <div className="p-2 border-t border-gray-100 dark:border-gray-800 flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="flex-1 justify-center dark:text-gray-400" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-3 py-2.5 flex items-center justify-between safe-top">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate px-2">
          {selectedBusinessName || 'AAROHAN HUB'}
        </h1>
        <div className="flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-white dark:bg-gray-900 shadow-xl overflow-y-auto">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-bold dark:text-gray-100">AAROHAN HUB</h2>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="p-2">
              {businesses.map((biz) => {
                const isActive = selectedBusinessId === biz.id;
                const colors = getBusinessColors(biz.name, isActive);
                const bizIcon = getBusinessIcon(biz.name);
                const showMenu = isActive && hasSubMenus(biz.name);

                return (
                  <div key={biz.id} className="mb-2">
                    <button
                      onClick={() => { setSelectedBusiness(biz.id, biz.name); setCurrentView('dashboard'); }}
                      className={`w-full flex items-center gap-2 px-3 py-3 rounded-lg text-left min-h-[48px] ${colors.bg} ${colors.text}`}
                    >
                      <div className={`h-7 w-7 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${colors.icon}`}>
                        {bizIcon || biz.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{biz.name}</p>
                        <p className="text-[10px] text-gray-400">{biz.type}</p>
                      </div>
                    </button>

                    {showMenu && (
                      <div className="ml-4 mt-1 space-y-0.5">
                        {AAROHAN_MENUS.map((menu) => (
                          <button
                            key={menu.id}
                            onClick={() => { setCurrentView(menu.id); setMobileMenuOpen(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm min-h-[44px] ${
                              currentView === menu.id ? `${getSubMenuActiveColor(biz.name)} font-medium` : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {menu.icon}
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
        {/* Desktop Top bar - NO chat button here */}
        <header className="hidden md:flex items-center justify-between px-6 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {showSubMenus ? (AAROHAN_MENUS.find(m => m.id === currentView)?.label || 'Dashboard') : 'Dashboard'}
            </h2>
            <Badge
              variant="secondary"
              className={`text-xs ${
                blueTheme
                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800'
                  : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
              }`}
            >
              {selectedBusinessName}
            </Badge>
          </div>
          <ThemeToggle />
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-auto pt-[56px] md:pt-0">
          {renderView()}
        </div>
      </main>

      {/* FLOATING CHAT BUTTON - always visible */}
      {selectedBusinessId && !chatOpen && (
        <button
          onClick={toggleChat}
          className={`fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 hover:shadow-xl ${
            blueTheme
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
          aria-label="Open AI Assistant"
        >
          <MessageSquare className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Chat Panel - slides from right */}
      {chatOpen && selectedBusinessId && (
        <ChatPanel businessId={selectedBusinessId} businessName={selectedBusinessName || ''} />
      )}
    </div>
  );
}
