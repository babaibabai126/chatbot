import { create } from 'zustand';

export type ViewType = 'dashboard' | 'clients' | 'bills' | 'quotations' | 'expenses' | 'payments' | 'dues' | 'chat';

interface AppState {
  selectedBusinessId: string | null;
  selectedBusinessName: string | null;
  currentView: ViewType;
  chatOpen: boolean;
  sidebarOpen: boolean;

  setSelectedBusiness: (id: string, name: string) => void;
  setCurrentView: (view: ViewType) => void;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedBusinessId: null,
  selectedBusinessName: null,
  currentView: 'dashboard',
  chatOpen: false,
  sidebarOpen: true,

  setSelectedBusiness: (id, name) => set({ selectedBusinessId: id, selectedBusinessName: name, currentView: 'dashboard' }),
  setCurrentView: (view) => set({ currentView: view }),
  setChatOpen: (open) => set({ chatOpen: open }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
