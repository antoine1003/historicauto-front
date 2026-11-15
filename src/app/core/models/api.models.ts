/**
 * Interfaces correspondant exactement au format JSON
 * retourné par l'API Symfony.
 */

// ── Réponse standard ──

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]> | ApiErrorDetail;
}

export interface ApiErrorDetail {
  exception: string;
  trace?: string;
  file?: string;
}

// ── Entité de base ──

export interface BaseEntity {
  id: number;
}
