import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { getLegacyRedirect } from './routing';
import './App.css';

const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const OverlayGenerator = lazy(() => import('./pages/OverlayGenerator'));
const PlayerOverlay = lazy(() => import('./pages/PlayerOverlay'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

function App() {
  const location = useLocation();
  const legacyRedirect = getLegacyRedirect(location.hash);
  useEffect(() => {
    if (location.pathname === '/admin') {
      document.title = 'LP Gain Event - Admin';
      return;
    }
    if (location.pathname === '/overlay-generator') {
      document.title = 'LP Gain Event - OBS Overlay';
      return;
    }
    if (location.pathname === '/overlay' || location.pathname.startsWith('/overlay/events/')) {
      document.title = 'LP Gain Event - Player Overlay';
      return;
    }
    document.title = 'LP Gain Event - Leaderboard';
  }, [location.pathname]);

  if (legacyRedirect) {
    return <Navigate to={legacyRedirect} replace />;
  }
  return (
    <Suspense
      fallback={
        <main className="page">
          <div className="status-screen">Loading...</div>
        </main>
      }
    >
      <Routes>
        <Route path="/" element={<LeaderboardPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/overlay-generator" element={<OverlayGenerator />} />
        <Route
          path="/overlay"
          element={<PlayerOverlay key={`${location.pathname}${location.search}`} />}
        />
        <Route
          path="/overlay/events/:eventId/players/:playerId"
          element={<PlayerOverlay key={location.pathname} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
