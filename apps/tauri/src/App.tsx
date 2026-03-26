import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./Layout";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import FeedPage from "./pages/Feed";
import MessagesPage from "./pages/Messages";
import FriendsPage from "./pages/Friends";
import ProfilePage from "./pages/Profile";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ backgroundColor: '#313338', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }} />
      </div>
    );
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/signup" element={<SignupPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Navigate to="/feed" />} />
                  <Route path="/feed" element={<FeedPage />} />
                  <Route path="/messages" element={<MessagesPage />} />
                  <Route path="/friends" element={<FriendsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/profile/:username" element={<ProfilePage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
