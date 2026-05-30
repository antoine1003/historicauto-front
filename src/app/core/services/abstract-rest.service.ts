import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  ApiResponse,
  BaseEntity,
  ListParams,
  PaginatedResponse,
  SingleParams,
} from '@app/core/models/api.models';
import { buildListParams, buildSingleParams } from '@app/core/utils/query-builder.helper';

/**
 * Service REST abstrait générique pour Angular 17+.
 *
 * Fournit un CRUD complet typé, compatible avec l'architecture
 * REST Symfony (AbstractRestController).
 *
 * Usage :
 *
 * ```typescript
 * @Injectable({ providedIn: 'root' })
 * export class UserService extends AbstractRestService<User> {
 *   constructor(http: HttpClient) {
 *     super(http, '/api/users');
 *   }
 * }
 * ```
 *
 * Fonctionnalités :
 * - Typage générique fort (T extends BaseEntity)
 * - Support du ?pick= pour enrichir les réponses
 * - Helpers pour les filtres avec opérateurs (gte, like, in...)
 * - Gestion d'erreurs centralisée
 */
export abstract class AbstractRestService<T extends BaseEntity> {
  protected constructor(
    protected readonly http: HttpClient,
    protected readonly resourceUrl: string
  ) {}

  // ──────────────────────────────────────────────
  //  GET — Liste paginée
  // ──────────────────────────────────────────────

  /**
   * Récupère une liste paginée d'entités.
   *
   * @example
   * // Liste simple
   * this.userService.list().subscribe(res => console.log(res.data));
   *
   * @example
   * // Avec pagination, tri, filtres et pick
   * this.userService.list({
   *   page: 2,
   *   limit: 10,
   *   sort: [{ field: 'name', direction: 'asc' }],
   *   pick: ['tagCount'],
   *   filters: {
   *     status: 'active',
   *     price: { gte: 10, lte: 100 },
   *   }
   * });
   */
  list(params: ListParams = {}): Observable<PaginatedResponse<T>> {
    const httpParams = buildListParams(params);

    return this.http
      .get<PaginatedResponse<T>>(this.resourceUrl, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  // ──────────────────────────────────────────────
  //  GET — Entité unique
  // ──────────────────────────────────────────────

  /**
   * Récupère une entité par son ID.
   *
   * @example
   * this.userService.get(3).subscribe(user => console.log(user));
   *
   * @example
   * // Avec pick pour récupérer des propriétés supplémentaires
   * this.userService.get(3, { pick: ['ip', 'lastLogin.ip', 'displayName'] });
   */
  get(id: number, params: SingleParams = {}): Observable<T> {
    const httpParams = buildSingleParams(params);

    return this.http
      .get<ApiResponse<T>>(`${this.resourceUrl}/${id}`, { params: httpParams })
      .pipe(
        map((res) => res.data),
        catchError(this.handleError)
      );
  }

  // ──────────────────────────────────────────────
  //  POST — Création
  // ──────────────────────────────────────────────

  /**
   * Crée une nouvelle entité.
   *
   * Les relations sont passées par ID :
   * - ManyToOne : `{ category: 5 }`
   * - ManyToMany : `{ tags: [1, 3, 7] }`
   *
   * @example
   * this.userService.create({
   *   name: 'John',
   *   email: 'john@example.com',
   *   category: 5,
   *   tags: [1, 3, 7]
   * });
   */
  create(body: Partial<T> | Record<string, unknown>): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(this.resourceUrl, body)
      .pipe(
        map((res) => res.data),
        catchError(this.handleError)
      );
  }

  // ──────────────────────────────────────────────
  //  PUT — Remplacement complet
  // ──────────────────────────────────────────────

  /**
   * Met à jour une entité (remplacement complet).
   *
   * @example
   * this.userService.update(3, {
   *   name: 'John Updated',
   *   email: 'john.updated@example.com',
   *   category: 2,
   *   tags: [1, 5]
   * });
   */
  update(id: number, body: Partial<T> | Record<string, unknown>): Observable<T> {
    return this.http
      .put<ApiResponse<T>>(`${this.resourceUrl}/${id}`, body)
      .pipe(
        map((res) => res.data),
        catchError(this.handleError)
      );
  }

  // ──────────────────────────────────────────────
  //  PATCH — Mise à jour partielle
  // ──────────────────────────────────────────────

  /**
   * Met à jour partiellement une entité.
   *
   * @example
   * this.userService.patch(3, { email: 'newemail@example.com' });
   */
  patch(id: number, body: Partial<T> | Record<string, unknown>): Observable<T> {
    return this.http
      .patch<ApiResponse<T>>(`${this.resourceUrl}/${id}`, body)
      .pipe(
        map((res) => res.data),
        catchError(this.handleError)
      );
  }

  // ──────────────────────────────────────────────
  //  DELETE — Suppression
  // ──────────────────────────────────────────────

  /**
   * Supprime une entité.
   *
   * @example
   * this.userService.delete(3).subscribe(() => console.log('Deleted'));
   */
  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.resourceUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  // ──────────────────────────────────────────────
  //  RACCOURCIS UTILES
  // ──────────────────────────────────────────────

  /**
   * Récupère TOUTES les entités (sans pagination, limit=100).
   * Utile pour les selects / autocomplete.
   */
  all(params: Omit<ListParams, 'page' | 'limit'> = {}): Observable<T[]> {
    return this.list({ ...params, page: 1, limit: 100 }).pipe(
      map((res) => res.data)
    );
  }

  /**
   * Vérifie si une entité existe.
   */
  exists(id: number): Observable<boolean> {
    return this.get(id).pipe(
      map(() => true),
      catchError(() => [false])
    );
  }

  /**
   * Raccourci pour lister avec un seul filtre.
   *
   * @example
   * this.userService.findBy('email', 'john@example.com');
   * this.userService.findBy('price', { gte: 10, lte: 50 });
   */
  findBy(
    field: string,
    value: unknown,
    params: Omit<ListParams, 'filters'> = {}
  ): Observable<PaginatedResponse<T>> {
    return this.list({
      ...params,
      filters: { [field]: value } as ListParams['filters'],
    });
  }

  // ──────────────────────────────────────────────
  //  GESTION D'ERREURS
  // ──────────────────────────────────────────────

  /**
   * Gestionnaire d'erreurs par défaut.
   * Peut être surchargé dans les services enfants.
   */
  protected handleError = (error: HttpErrorResponse): Observable<never> => {
    const apiError = this.parseApiError(error);
    console.error(`[${this.resourceUrl}]`, apiError);
    return throwError(() => apiError);
  };

  protected parseApiError(error: HttpErrorResponse): RestApiError {
    // Réponse JSON de notre API Symfony
    if (error.error?.success === false) {
      return {
        status: error.status,
        message: error.error.message ?? 'An error occurred.',
        errors: error.error.errors ?? null,
        isValidation: error.status === 422,
      };
    }

    // Erreur réseau ou autre
    return {
      status: error.status || 0,
      message:
        error.status === 0
          ? 'Network error — server unreachable.'
          : error.statusText || 'Unknown error.',
      errors: null,
      isValidation: false,
    };
  }
}

// ── Types d'erreur ──

export interface RestApiError {
  status: number;
  message: string;
  errors: Record<string, string[]> | null;
  /** true si c'est une erreur de validation (422) */
  isValidation: boolean;
}
