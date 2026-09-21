import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { getLegacyRedirect } from './routing';
import './App.css';

const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const OverlayGenerator = lazy(() => import('./pages/OverlayGenerator'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const PlayerOverlay = lazy(() => import('./pages/PlayerOverlay'));
const EventHistoryPage = lazy(() => import('./pages/EventHistoryPage'));
const EventHistoryDetailsPage = lazy(() => import('./pages/EventHistoryDetailsPage'));
const PlayerDetailsPage = lazy(() => import('./pages/PlayerDetailsPage'));

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
    if (location.pathname.startsWith('/players/')) {
      document.title = 'LP Gain Event - Player Details';
      return;
    }
    if (location.pathname === '/history' || location.pathname.startsWith('/history/')) {
      document.title = 'LP Gain Event - Event History';
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
        <Route path="/history" element={<EventHistoryPage />} />
        <Route path="/history/:eventId" element={<EventHistoryDetailsPage />} />
        <Route path="/players/:playerId" element={<PlayerDetailsPage />} />
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
