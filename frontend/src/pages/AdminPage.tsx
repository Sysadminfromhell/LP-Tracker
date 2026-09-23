import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import type { AdminMeResponse, AdminSessionUser } from '@lp-tracker/contracts';
import AdminDashboard from './AdminDashboard';
import AdminDatabaseAdvancedPage from './AdminDatabaseAdvancedPage';
import AdminDatabaseTablePage from './AdminDatabaseTablePage';
import AdminLogin from './AdminLogin';

function AdminPage() {
  const location = useLocation();
  const [admin, setAdmin] = useState<AdminSessionUser | null>(null);
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
    const timer = window.setTimeout(() => {
      void checkSession();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
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
  if (location.pathname.startsWith('/admin/database/tables/')) {
    return (
      <AdminDatabaseTablePage
        username={currentAdmin.username}
        onLogout={() => {
          void logout();
        }}
      />
    );
  }
  if (location.pathname === '/admin/database') {
    return (
      <AdminDatabaseAdvancedPage
        username={currentAdmin.username}
        onLogout={() => {
          void logout();
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
