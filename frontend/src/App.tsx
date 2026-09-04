import { lazy, Suspense, useEffect, useState } from 'react';
import './App.css';

const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const OverlayGenerator = lazy(() => import('./pages/OverlayGenerator'));
const PlayerOverlay = lazy(() => import('./pages/PlayerOverlay'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

function useHash(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    function handleHashChange() {
      setHash(window.location.hash);
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);
  return hash;
}

function App() {
  const hash = useHash();
  useEffect(() => {
    if (hash.startsWith('#admin')) {
      document.title = 'LP Gain Event - Admin';
      return;
    }
    if (hash.startsWith('#overlay_generator')) {
      document.title = 'LP Gain Event - OBS Overlay';
      return;
    }
    if (hash.startsWith('#overlay?')) {
      document.title = 'LP Gain Event - Player Overlay';
      return;
    }
    document.title = 'LP Gain Event - Leaderboard';
  }, [hash]);

  let page;

  if (hash.startsWith('#admin')) {
    page = <AdminPage />;
  } else if (hash.startsWith('#overlay_generator')) {
    page = <OverlayGenerator />;
  } else if (hash.startsWith('#overlay?')) {
    page = <PlayerOverlay key={hash} />;
  } else {
    page = <LeaderboardPage />;
  }

  return (
    <Suspense
      fallback={
        <main className="page">
          <div className="status-screen">Loading...</div>
        </main>
      }
    >
      {page}
    </Suspense>
  );
}

export default App;
