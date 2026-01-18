import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Notification {
  id: number;
  userId: number;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: any;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  lastFetch: number | null;

  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: number) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: number) => void;
  
  updateUnreadCount: () => void;
  setLoading: (isLoading: boolean) => void;

  // API Actions
  fetchNotifications: () => Promise<void>;
  markNotificationAsRead: (notificationId: number) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  deleteNotification: (notificationId: number) => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>()(
  devtools(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      lastFetch: null,

      setNotifications: (notifications) => {
        const unreadCount = notifications.filter(n => !n.read).length;
        set({ notifications, unreadCount, lastFetch: Date.now() });
      },

      addNotification: (notification) => set((state) => {
        // Check if notification already exists
        if (state.notifications.some(n => n.id === notification.id)) {
          return state;
        }
        
        const notifications = [notification, ...state.notifications];
        const unreadCount = notifications.filter(n => !n.read).length;
        return { notifications, unreadCount };
      }),

      markAsRead: (notificationId) => set((state) => {
        const notifications = state.notifications.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        );
        const unreadCount = notifications.filter(n => !n.read).length;
        return { notifications, unreadCount };
      }),

      markAllAsRead: () => set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      })),

      removeNotification: (notificationId) => set((state) => {
        const notifications = state.notifications.filter(n => n.id !== notificationId);
        const unreadCount = notifications.filter(n => !n.read).length;
        return { notifications, unreadCount };
      }),

      updateUnreadCount: () => set((state) => ({
        unreadCount: state.notifications.filter(n => !n.read).length
      })),

      setLoading: (isLoading) => set({ isLoading }),

      // API Actions
      fetchNotifications: async () => {
        const { lastFetch } = get();
        // Cache for 15 seconds
        if (lastFetch && Date.now() - lastFetch < 15000) {
          return;
        }

        set({ isLoading: true });
        try {
          const res = await fetch('/api/notifications');
          if (res.ok) {
            const data = await res.json();
            get().setNotifications(data);
          }
        } catch (error) {
          console.error('Failed to fetch notifications:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      markNotificationAsRead: async (notificationId: number) => {
        // Optimistically update
        get().markAsRead(notificationId);
        
        try {
          const res = await fetch(`/api/notifications/${notificationId}`, {
            method: 'PUT',
          });

          if (!res.ok) {
            // Revert on failure
            await get().fetchNotifications();
          }
        } catch (error) {
          console.error('Failed to mark notification as read:', error);
          // Revert on failure
          await get().fetchNotifications();
        }
      },

      markAllNotificationsAsRead: async () => {
        // Optimistically update
        get().markAllAsRead();
        
        try {
          const res = await fetch('/api/notifications/mark-all-read', {
            method: 'POST',
          });

          if (!res.ok) {
            // Revert on failure
            await get().fetchNotifications();
          }
        } catch (error) {
          console.error('Failed to mark all notifications as read:', error);
          // Revert on failure
          await get().fetchNotifications();
        }
      },

      deleteNotification: async (notificationId: number) => {
        // Optimistically remove
        get().removeNotification(notificationId);
        
        try {
          const res = await fetch(`/api/notifications/${notificationId}`, {
            method: 'DELETE',
          });

          if (!res.ok) {
            // Revert on failure
            await get().fetchNotifications();
          }
        } catch (error) {
          console.error('Failed to delete notification:', error);
          // Revert on failure
          await get().fetchNotifications();
        }
      },
    }),
    { name: 'NotificationsStore' }
  )
);
