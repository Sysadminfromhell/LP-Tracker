import { useEffect, useState } from 'react';
import './App.css';
import LeaderboardPage from './pages/LeaderboardPage';
import OverlayGenerator from './pages/OverlayGenerator';
import PlayerOverlay from './pages/PlayerOverlay';
import AdminPage from './pages/AdminPage';

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

  if (hash.startsWith('#admin')) {
    return <AdminPage />;
  }
  if (hash.startsWith('#overlay_generator')) {
    return <OverlayGenerator />;
  }
  if (hash.startsWith('#overlay?')) {
    return <PlayerOverlay key={hash} />;
  }
  return <LeaderboardPage />;
}
export default App;
