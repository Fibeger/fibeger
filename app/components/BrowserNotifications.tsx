'use client';

import { useBrowserNotifications } from '@/app/hooks/useBrowserNotifications';
import { useNotificationSound } from '@/app/hooks/useNotificationSound';
import { useRealtimeEvents } from '@/app/hooks/useRealtimeEvents';
import { useSession } from 'next-auth/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Component that initializes browser notifications and sounds
 * 
 * This component doesn't render anything visible, but manages
 * the browser notification system and notification sounds in the background.
 * 
 * Place this component at the root level of your app (in Providers)
 * to enable browser notifications throughout the application.
 */
export default function BrowserNotifications() {
  const { isSupported, permission, isEnabled } = useBrowserNotifications();
  const { playSound } = useNotificationSound();
  const { on } = useRealtimeEvents();
  const { data: session } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Log status for debugging (optional, can remove in production)
  useEffect(() => {
    if (isSupported) {
      console.log('[Browser Notifications] Status:', {
        permission,
        isEnabled,
      });
    } else {
      console.warn('[Browser Notifications] Not supported in this browser');
    }
  }, [isSupported, permission, isEnabled]);

  // Global message sound handler - plays when NOT viewing the chat
  useEffect(() => {
    if (!session?.user?.id) return;

    const currentUserId = parseInt((session.user as any).id || '0');
    
    const handleMessage = (event: any) => {
      const messageConvId = event.data.conversationId;
      const messageGroupId = event.data.groupChatId;
      const newMessage = event.data.message;

      // Don't play for own messages
      if (newMessage?.sender?.id === currentUserId) {
        return;
      }

      // Check if we're currently viewing the chat that this message is from
      const isOnMessagesPage = pathname === '/messages';
      
      if (!isOnMessagesPage) {
        // Not on messages page, always play sound
        playSound();
        return;
      }

      // On messages page - check if viewing the specific chat
      const currentDmId = searchParams?.get('dm');
      const currentGroupId = searchParams?.get('group');

      const isViewingThisChat = 
        (currentDmId && messageConvId && messageConvId === parseInt(currentDmId)) ||
        (currentGroupId && messageGroupId && messageGroupId === parseInt(currentGroupId));

      // Only play sound if we're NOT viewing this specific chat
      if (!isViewingThisChat) {
        playSound();
      }
    };

    const unsubscribe = on('message', handleMessage);
    
    return () => {
      unsubscribe();
    };
  }, [on, playSound, session?.user?.id, pathname, searchParams]);

  // This component doesn't render anything
  return null;
}
