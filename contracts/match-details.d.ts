export type MatchParticipantSide = 'ALLY' | 'ENEMY';
export type MatchParticipantPosition = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'UNKNOWN';
export interface MatchDetailParticipant {
  side: MatchParticipantSide;
  position: MatchParticipantPosition;
  championId: number;
  champion: string;
  kills: number;
  deaths: number;
  assists: number;
  laneCs: number;
  jungleCs: number;
  cs: number;
  damageToChampions: number;
  items: string[];
  isTrackedPlayer: boolean;
}
export interface MatchDetailsResponse {
  matchId: string;
  durationSeconds: number;
  participants: MatchDetailParticipant[];
}
