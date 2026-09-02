export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}
export interface RiotApiErrorResponse {
  status?: {
    message?: string;
    status_code?: number;
  };
}
