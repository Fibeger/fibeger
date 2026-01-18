"use client";

import { SessionProvider } from "next-auth/react";
import BrowserNotifications from "./components/BrowserNotifications";
import { useStoreSync } from "./hooks/useStoreSync";

function StoreSync() {
  useStoreSync();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <StoreSync />
      <BrowserNotifications />
      {children}
    </SessionProvider>
  );
}
