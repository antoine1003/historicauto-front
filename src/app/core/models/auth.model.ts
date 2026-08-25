import { BaseEntity } from '@app/core/models/api.models';

// ── Requêtes ──

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  email: string;
  password: string;
  [key: string]: unknown; // Champs supplémentaires (name, etc.)
}

// ── Réponses ──

/** Réponse du endpoint lexik /api/auth/login */
export interface JwtResponse {
  token: string;
  refresh_token?: string;
}

/** Réponse du endpoint register (ApiResponse Symfony) */
export interface RegisterResponse {
  success: boolean;
  data: AuthUser;
  message?: string;
}

/** Réponse du endpoint /api/me */
export interface MeResponse {
  authenticated: boolean;
  user?: AuthUser;
}

// ── Utilisateur ──

export interface AuthUser extends BaseEntity {
  email: string;
  roles: string[];
  isVerified: boolean;
}

// ── JWT décodé ──

export interface JwtPayload {
  iat: number;
  exp: number;
  roles: string[];
  username: string; // lexik met l'email dans "username"
  [key: string]: unknown;
}
