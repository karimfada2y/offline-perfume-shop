import { create } from 'zustand';

interface AppState {
  sidebarOpen: boolean;
  currentPath: string;
  notifications: Array<{ id: number; message: string; type: 'success' | 'error' | 'warning' | 'info' }>;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCurrentPath: (path: string) => void;
  addNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  removeNotification: (id: number) => void;
}

let notifId = 0;

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  currentPath: '/',
  notifications: [],
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCurrentPath: (path) => set({ currentPath: path }),
  addNotification: (message, type) => {
    const id = ++notifId;
    set((state) => ({
      notifications: [...state.notifications, { id, message, type }],
    }));
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 5000);
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
