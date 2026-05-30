/**
 * Interfaces correspondant exactement au format JSON
 * retourné par l'architecture REST Symfony.
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

// ── Réponse paginée ──

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// ── Paramètres de requête ──

export type SortDirection = 'asc' | 'desc';

export interface SortParam {
  field: string;
  direction: SortDirection;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ListParams extends PaginationParams {
  sort?: SortParam[];
  pick?: string[];
  filters?: FilterMap;
}

export interface SingleParams {
  pick?: string[];
}

// ── Filtres avec opérateurs ──

export type FilterOperator = 'eq' | 'gte' | 'gt' | 'lte' | 'lt' | 'neq' | 'like' | 'in';

export type FilterValue = string | number | boolean | null;

/**
 * Filtre simple (égalité) ou avec opérateur :
 *
 * { status: 'active' }                     → ?status=active
 * { price: { gte: 10, lte: 100 } }         → ?price_gte=10&price_lte=100
 * { name: { like: 'widget' } }             → ?name_like=widget
 * { category: { in: [1, 3, 5] } }          → ?category_in=1,3,5
 */
export type FilterMap = Record<string, FilterValue | Partial<Record<FilterOperator, FilterValue | FilterValue[]>>>;

// ── Entité de base ──

export interface BaseEntity {
  id: number;
}
