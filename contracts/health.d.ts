export interface BuildInfo {
  version: string;
  gitHead: string;
}
export interface ProviderRateLimitBucket {
  limit: number;
  count: number | null;
  windowSeconds: number;
}
export interface ProviderRateLimitStatus {
  buckets: ProviderRateLimitBucket[];
  restricted: boolean;
}
export interface ProviderHealth {
  name: string | null;
  connected: boolean;
  rateLimit: ProviderRateLimitStatus | null;
  warning: string | null;
}
export interface HealthResponse {
  status: 'ok';
  build: BuildInfo;
  database: {
    connected: boolean;
  };
  provider: ProviderHealth;
  event: {
    id: number | null;
    status: 'draft' | 'scheduled' | 'active' | 'ended' | null;
  };
  players: {
    enabled: number;
    event: number;
    cached: number;
  };
  scheduler: {
    targetRefreshMs: number;
    spacingMs: number;
    spacingSeconds: number;
  };
}
