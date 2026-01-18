import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface User {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
  email?: string;
  bio?: string | null;
  banner?: string | null;
  location?: string | null;
  website?: string | null;
  steamUsername?: string | null;
  personalityBadge?: string | null;
  showPersonalityBadge?: boolean;
  notificationSoundsEnabled?: boolean;
  createdAt?: string;
}

interface UserState {
  currentUser: User | null;
  isLoading: boolean;
  
  // Actions
  setCurrentUser: (user: User | null) => void;
  updateCurrentUser: (updates: Partial<User>) => void;
  clearCurrentUser: () => void;
}

export const useUserStore = create<UserState>()(
  devtools(
    (set) => ({
      currentUser: null,
      isLoading: false,

      setCurrentUser: (user) => set({ currentUser: user }),
      
      updateCurrentUser: (updates) => set((state) => ({
        currentUser: state.currentUser ? { ...state.currentUser, ...updates } : null
      })),
      
      clearCurrentUser: () => set({ currentUser: null }),
    }),
    { name: 'UserStore' }
  )
);
