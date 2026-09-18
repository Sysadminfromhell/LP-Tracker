export interface ErrorResponse {
  error: string;
}
export interface AdminSummary {
  id: number;
  username: string;
}
export interface LoginResponse {
  ok: boolean;
  admin: AdminSummary;
}
export interface OkResponse {
  ok: boolean;
}
export interface AdminSessionUser extends AdminSummary {
  lastLoginAt: string | null;
}
export interface AdminMeResponse {
  authenticated: boolean;
  admin: AdminSessionUser;
}
