export type AdminEventStatus = 'draft' | 'scheduled' | 'active' | 'ended';
export interface AdminEvent {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string | null;
  status: AdminEventStatus;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface AdminEventsResponse {
  events: AdminEvent[];
}
export interface AdminEventDetailsResponse {
  event: AdminEvent;
  selectedPlayerIds: number[];
}
export interface AdminEventResponse {
  ok: boolean;
  event: AdminEvent;
}
export interface EventParticipantPenalty {
  eventId: number;
  playerId: number;
  gameName: string;
  tagLine: string;
  startTier: string;
  startDivision: number | null;
  startLp: number;
  startRankScore: number;
  lpPenalty: number;
  penaltyReason: string | null;
  penaltyUpdatedAt: string | null;
}
export interface EventParticipantPenaltiesResponse {
  participants: EventParticipantPenalty[];
}
export interface EventParticipantPenaltyResponse {
  ok: boolean;
  participant: EventParticipantPenalty;
}
