"use client";

import { AuthContext, useAuthProvider } from "./hooks/useAuth";
import BrowserNotifications from "./components/BrowserNotifications";

export function Providers({ children }: { children: React.ReactNode }) {
  const auth = useAuthProvider();

  return (
    <AuthContext.Provider value={auth}>
      <BrowserNotifications />
      {children}
    </AuthContext.Provider>
  );
}
