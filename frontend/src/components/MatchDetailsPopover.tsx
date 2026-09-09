import { useEffect, useState } from 'react';
import { loadItemIconUrls } from '../itemIcons';
import type {
  MatchDetailParticipant,
  MatchDetailsResponse,
  MatchParticipantPosition,
  MatchParticipantSide,
} from '../matchDetails';

interface MatchDetailsPopoverProps {
  details: MatchDetailsResponse | null;
  loading: boolean;
  unavailable: boolean;
  error: string | null;
  x: number;
  y: number;
  placement: 'above' | 'below';
  championIcons: Map<number, string>;
}

const roleOrder: MatchParticipantPosition[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

function formatRole(role: MatchParticipantPosition): string {
  switch (role) {
    case 'JUNGLE':
      return 'JGL';
    case 'SUPPORT':
      return 'SUP';
    default:
      return role;
  }
}
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:` + String(remainingSeconds).padStart(2, '0');
}
function formatDamage(damage: number): string {
  if (damage >= 1000) {
    return `${(damage / 1000).toFixed(1)}k`;
  }

  return String(damage);
}
function formatTeamKda(participants: MatchDetailParticipant[], side: MatchParticipantSide): string {
  const totals = participants
    .filter((participant) => participant.side === side)
    .reduce(
      (sum, participant) => ({
        kills: sum.kills + participant.kills,
        deaths: sum.deaths + participant.deaths,
        assists: sum.assists + participant.assists,
      }),
      {
        kills: 0,
        deaths: 0,
        assists: 0,
      },
    );
  return `${totals.kills}/${totals.deaths}/${totals.assists}`;
}
function Participant({
  participant,
  side,
  championIcons,
  itemIcons,
}: {
  participant: MatchDetailParticipant | undefined;
  side: MatchParticipantSide;
  championIcons: Map<number, string>;
  itemIcons: Map<string, string>;
}) {
  if (!participant) {
    return (
      <div
        className={`match-detail-player ` + `${side.toLowerCase()} ` + 'match-detail-player-empty'}
      >
        —
      </div>
    );
  }
  const championIcon = championIcons.get(participant.championId);
  const champion = championIcon ? (
    <img
      className="match-detail-champion"
      src={championIcon}
      alt={participant.champion}
      title={participant.champion}
    />
  ) : (
    <div className="match-detail-champion match-detail-champion-placeholder" />
  );
  const stats = (
    <div className="match-detail-stats">
      <strong>
        {participant.kills}/{participant.deaths}/{participant.assists}
      </strong>
      <span>
        {participant.cs} CS
        {' · '}
        {formatDamage(participant.damageToChampions)} DMG
      </span>
    </div>
  );
  const items = (
    <div className="match-detail-items">
      {Array.from({
        length: 6,
      }).map((_, index) => {
        const itemId = participant.items[index];
        const itemIcon = itemId ? itemIcons.get(itemId) : undefined;
        return (
          <span className="match-detail-item" key={index}>
            {itemIcon && <img src={itemIcon} alt="" aria-hidden="true" title={`Item ${itemId}`} />}
          </span>
        );
      })}
    </div>
  );
  return (
    <div
      className={
        `match-detail-player ` +
        `${side.toLowerCase()} ` +
        `${participant.isTrackedPlayer ? 'tracked' : ''}`
      }
    >
      <div className="match-detail-player-main">
        {side === 'ALLY' && items}
        {side === 'ENEMY' && champion}

        {stats}

        {side === 'ALLY' && champion}
        {side === 'ENEMY' && items}
      </div>
    </div>
  );
}
export default function MatchDetailsPopover({
  details,
  loading,
  unavailable,
  error,
  x,
  y,
  placement,
  championIcons,
}: MatchDetailsPopoverProps) {
  const [itemIcons, setItemIcons] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!details) {
      return;
    }
    const itemIds = Array.from(
      new Set(details.participants.flatMap((participant) => participant.items)),
    );
    if (itemIds.length === 0) {
      return;
    }
    let cancelled = false;
    void loadItemIconUrls(itemIds)
      .then((icons) => {
        if (!cancelled) {
          setItemIcons(icons);
        }
      })
      .catch((err) => {
        console.warn('Failed to load item icons:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [details]);
  return (
    <div
      className={`match-detail-popover ` + `match-detail-popover-${placement}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      {loading && <div className="match-detail-status">Loading match details...</div>}
      {!loading && error && <div className="match-detail-status error">{error}</div>}
      {!loading && !error && unavailable && (
        <div className="match-detail-status">Detailed match data is not available.</div>
      )}
      {!loading && !error && !unavailable && details && (
        <>
          <div className="match-detail-header">
            <span className="match-detail-team ally">
              <span className="match-detail-team-label">ALLY</span>
              <span className="match-detail-team-kda">
                {formatTeamKda(details.participants, 'ALLY')}
              </span>
            </span>
            <div>
              <strong>MATCH DETAILS</strong>
              <span>{formatDuration(details.durationSeconds)}</span>
            </div>
            <span className="match-detail-team enemy">
              <span className="match-detail-team-label">ENEMY</span>
              <span className="match-detail-team-kda">
                {formatTeamKda(details.participants, 'ENEMY')}
              </span>
            </span>
          </div>
          <div className="match-detail-roles">
            {roleOrder.map((role) => {
              const ally = details.participants.find(
                (participant) => participant.side === 'ALLY' && participant.position === role,
              );
              const enemy = details.participants.find(
                (participant) => participant.side === 'ENEMY' && participant.position === role,
              );
              return (
                <div className="match-detail-role-row" key={role}>
                  <Participant
                    participant={ally}
                    side="ALLY"
                    championIcons={championIcons}
                    itemIcons={itemIcons}
                  />
                  <div className="match-detail-role">{formatRole(role)}</div>
                  <Participant
                    participant={enemy}
                    side="ENEMY"
                    championIcons={championIcons}
                    itemIcons={itemIcons}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
