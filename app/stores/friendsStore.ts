import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface UserPreview {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}

export interface FriendRequest {
  id: number;
  sender: UserPreview;
  status: string;
  createdAt: string;
}

interface FriendsState {
  friends: UserPreview[];
  friendRequests: FriendRequest[];
  searchResults: UserPreview[];
  isLoading: boolean;
  isSearching: boolean;
  lastFetch: number | null;

  // Actions
  setFriends: (friends: UserPreview[]) => void;
  addFriend: (friend: UserPreview) => void;
  removeFriend: (friendId: number) => void;
  
  setFriendRequests: (requests: FriendRequest[]) => void;
  removeFriendRequest: (requestId: number) => void;
  
  setSearchResults: (results: UserPreview[]) => void;
  clearSearchResults: () => void;
  
  setLoading: (isLoading: boolean) => void;
  setSearching: (isSearching: boolean) => void;
  
  // API Actions
  fetchFriends: () => Promise<void>;
  fetchFriendRequests: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  sendFriendRequest: (username: string) => Promise<{ success: boolean; error?: string }>;
  respondToRequest: (requestId: number, action: 'accept' | 'reject') => Promise<{ success: boolean; error?: string }>;
  removeFriendById: (friendId: number) => Promise<{ success: boolean; error?: string }>;
}

export const useFriendsStore = create<FriendsState>()(
  devtools(
    (set, get) => ({
      friends: [],
      friendRequests: [],
      searchResults: [],
      isLoading: false,
      isSearching: false,
      lastFetch: null,

      setFriends: (friends) => set({ friends, lastFetch: Date.now() }),
      
      addFriend: (friend) => set((state) => ({
        friends: [...state.friends, friend]
      })),
      
      removeFriend: (friendId) => set((state) => ({
        friends: state.friends.filter(f => f.id !== friendId)
      })),

      setFriendRequests: (requests) => set({ friendRequests: requests }),
      
      removeFriendRequest: (requestId) => set((state) => ({
        friendRequests: state.friendRequests.filter(r => r.id !== requestId)
      })),

      setSearchResults: (results) => set({ searchResults: results }),
      clearSearchResults: () => set({ searchResults: [] }),
      
      setLoading: (isLoading) => set({ isLoading }),
      setSearching: (isSearching) => set({ isSearching }),

      // API Actions
      fetchFriends: async () => {
        const { lastFetch } = get();
        // Cache for 30 seconds
        if (lastFetch && Date.now() - lastFetch < 30000) {
          return;
        }

        set({ isLoading: true });
        try {
          const res = await fetch('/api/friends');
          if (res.ok) {
            const data = await res.json();
            set({ friends: data, lastFetch: Date.now() });
          }
        } catch (error) {
          console.error('Failed to load friends:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      fetchFriendRequests: async () => {
        try {
          const res = await fetch('/api/friends/request/dummy');
          if (res.ok) {
            const data = await res.json();
            set({ friendRequests: data });
          }
        } catch (error) {
          console.error('Failed to load friend requests:', error);
        }
      },

      searchUsers: async (query: string) => {
        if (query.trim().length === 0) {
          set({ searchResults: [] });
          return;
        }

        set({ isSearching: true });
        try {
          const res = await fetch(`/api/friends/request?query=${encodeURIComponent(query)}`);
          if (res.ok) {
            const data = await res.json();
            set({ searchResults: data });
          }
        } catch (error) {
          console.error('Failed to search users:', error);
        } finally {
          set({ isSearching: false });
        }
      },

      sendFriendRequest: async (username: string) => {
        try {
          const res = await fetch('/api/friends/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiverUsername: username }),
          });

          if (res.ok) {
            set({ searchResults: [] });
            return { success: true };
          } else {
            const error = await res.json();
            return { success: false, error: error.error || 'Failed to send request' };
          }
        } catch (error) {
          return { success: false, error: 'Error sending friend request' };
        }
      },

      respondToRequest: async (requestId: number, action: 'accept' | 'reject') => {
        try {
          const res = await fetch(`/api/friends/request/${requestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
          });

          if (res.ok) {
            // Remove from requests
            get().removeFriendRequest(requestId);
            
            // Refresh friends list if accepted
            if (action === 'accept') {
              await get().fetchFriends();
            }
            
            return { success: true };
          } else {
            return { success: false, error: 'Failed to respond to request' };
          }
        } catch (error) {
          return { success: false, error: 'Error responding to request' };
        }
      },

      removeFriendById: async (friendId: number) => {
        try {
          const res = await fetch(`/api/friends?friendId=${friendId}`, {
            method: 'DELETE',
          });

          if (res.ok) {
            get().removeFriend(friendId);
            return { success: true };
          } else {
            const error = await res.json();
            return { success: false, error: error.error || 'Failed to remove friend' };
          }
        } catch (error) {
          return { success: false, error: 'Error removing friend' };
        }
      },
    }),
    { name: 'FriendsStore' }
  )
);
