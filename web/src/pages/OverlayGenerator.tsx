import { useEffect, useMemo, useState } from 'react';

interface Player {
  player: {
    gameName: string;
    tagLine: string;
    region: string;
  };
}

interface LeaderboardResponse {
  ready: boolean;
  players: Player[];
}

function getPlayerKey(player: Player): string {
  return `${player.player.region}:` + `${player.player.gameName}#${player.player.tagLine}`;
}

function OverlayGenerator() {
  const [players, setPlayers] = useState<Player[]>([]);

  const [selectedPlayerKey, setSelectedPlayerKey] = useState('');

  const [copied, setCopied] = useState(false);

  /*
   * Leaderboard laden
   */
  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/leaderboard');

        if (!response.ok) {
          throw new Error(`API returned HTTP ${response.status}`);
        }

        const data = (await response.json()) as LeaderboardResponse;

        setPlayers(data.players);

        /*
         * Beim ersten Laden automatisch
         * ersten Spieler auswählen.
         */
        if (data.players.length > 0) {
          setSelectedPlayerKey((current) => current || getPlayerKey(data.players[0]));
        }
      } catch (error) {
        console.error('Failed to load players:', error);
      }
    }

    void load();
  }, []);

  /*
   * Aktuell ausgewählten Spieler ermitteln.
   */
  const selectedPlayer = useMemo(
    () => players.find((player) => getPlayerKey(player) === selectedPlayerKey) ?? null,
    [players, selectedPlayerKey],
  );

  /*
   * OBS URL generieren.
   */
  const overlayUrl = useMemo(() => {
    if (!selectedPlayer) {
      return '';
    }

    const params = new URLSearchParams({
      region: selectedPlayer.player.region,

      name: selectedPlayer.player.gameName,

      tag: selectedPlayer.player.tagLine,
    });

    return window.location.origin + window.location.pathname + '#overlay?' + params.toString();
  }, [selectedPlayer]);

  async function copyUrl() {
    if (!overlayUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(overlayUrl);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (error) {
      console.error('Could not copy overlay URL:', error);
    }
  }

  return (
    <main className="generator-page">
      <section className="generator-card">
        <div className="generator-heading">
          <div>
            <span className="eyebrow">LP GAIN EVENT</span>

            <h1>OBS Overlay</h1>

            <p>Select a player and add the generated URL as an OBS Browser Source.</p>
          </div>

          <a href="#" className="back-link">
            Back to leaderboard
          </a>
        </div>

        <div className="generator-controls">
          <label>
            Player
            <select
              value={selectedPlayerKey}
              onChange={(event) => {
                setSelectedPlayerKey(event.target.value);

                setCopied(false);
              }}
            >
              {players.map((player) => {
                const key = getPlayerKey(player);

                return (
                  <option key={key} value={key}>
                    {player.player.gameName}#{player.player.tagLine}
                  </option>
                );
              })}
            </select>
          </label>

          <label>
            Browser Source URL
            <div className="url-row">
              <input readOnly value={overlayUrl} />

              <button type="button" onClick={copyUrl}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </label>
        </div>

        <div className="obs-settings">
          <span>Recommended OBS size</span>

          <strong>760 × 150</strong>

          <span>Transparent background</span>
        </div>

        {overlayUrl && (
          <div className="overlay-preview">
            <div className="preview-label">PREVIEW</div>

            <iframe
              /*
               * Wichtig:
               *
               * Ein anderer Spieler
               * erzeugt einen anderen
               * key.
               *
               * Dadurch wird das iframe
               * komplett neu erzeugt.
               */
              key={overlayUrl}
              title="OBS Overlay Preview"
              src={overlayUrl}
            />
          </div>
        )}
      </section>
    </main>
  );
}

export default OverlayGenerator;
