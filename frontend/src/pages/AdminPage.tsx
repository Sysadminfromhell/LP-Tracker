import { useCallback, useEffect, useState } from 'react';
import AdminDashboard from './AdminDashboard';
import AdminLogin from './AdminLogin';

interface AdminUser {
  id: number;
  username: string;
  lastLoginAt: string | null;
}

interface AdminMeResponse {
  authenticated: boolean;
  admin: AdminUser;
}

function AdminPage() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const checkSession = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/me');
      if (response.status === 401) {
        setAdmin(null);
        return;
      }
      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`);
      }
      const data = (await response.json()) as AdminMeResponse;
      setAdmin(data.admin);
    } catch (error) {
      console.error('Failed to check admin session:', error);
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void checkSession();
  }, [checkSession]);
  async function logout() {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
    } finally {
      setAdmin(null);
    }
  }
  if (loading) {
    return (
      <main className="admin-page">
        <div className="admin-loading">Checking session...</div>
      </main>
    );
  }
  const currentAdmin = admin;
  if (!currentAdmin) {
    return (
      <AdminLogin
        onLogin={() => {
          void checkSession();
        }}
      />
    );
  }
  return (
    <AdminDashboard
      username={currentAdmin.username}
      onLogout={() => {
        void logout();
      }}
    />
  );
}

export default AdminPage;
