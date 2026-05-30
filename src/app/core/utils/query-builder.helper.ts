import { HttpParams } from '@angular/common/http';
import {
  FilterMap,
  FilterOperator,
  FilterValue,
  ListParams,
  SingleParams,
  SortParam,
} from '../models/api.models';

/**
 * Construit les HttpParams à partir des ListParams / SingleParams.
 *
 * Transforme la structure typée en query string compatible
 * avec l'architecture REST Symfony.
 *
 * Exemple :
 *   buildListParams({
 *     page: 2,
 *     limit: 10,
 *     sort: [{ field: 'price', direction: 'desc' }, { field: 'name', direction: 'asc' }],
 *     pick: ['ip', 'lastLogin.ip'],
 *     filters: {
 *       status: 'active',
 *       price: { gte: 10, lte: 100 },
 *       name: { like: 'widget' },
 *     }
 *   })
 *
 *   → ?page=2&limit=10&sort=-price,name&pick=ip,lastLogin.ip&status=active&price_gte=10&price_lte=100&name_like=widget
 */
export function buildListParams(params: ListParams): HttpParams {
  let httpParams = new HttpParams();

  // Pagination
  if (params.page != null) {
    httpParams = httpParams.set('page', params.page.toString());
  }
  if (params.limit != null) {
    httpParams = httpParams.set('limit', params.limit.toString());
  }

  // Tri
  if (params.sort?.length) {
    httpParams = httpParams.set('sort', buildSortString(params.sort));
  }

  // Pick
  if (params.pick?.length) {
    httpParams = httpParams.set('pick', params.pick.join(','));
  }

  // Filtres
  if (params.filters) {
    httpParams = applyFilters(httpParams, params.filters);
  }

  return httpParams;
}

export function buildSingleParams(params: SingleParams): HttpParams {
  let httpParams = new HttpParams();

  if (params.pick?.length) {
    httpParams = httpParams.set('pick', params.pick.join(','));
  }

  return httpParams;
}

// ── Helpers internes ──

function buildSortString(sorts: SortParam[]): string {
  return sorts
    .map((s) => (s.direction === 'desc' ? `-${s.field}` : s.field))
    .join(',');
}

const FILTER_OPERATORS: FilterOperator[] = [
  'eq', 'gte', 'gt', 'lte', 'lt', 'neq', 'like', 'in',
];

function isOperatorObject(
  value: unknown
): value is Partial<Record<FilterOperator, FilterValue | FilterValue[]>> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.keys(value).some((key) =>
    FILTER_OPERATORS.includes(key as FilterOperator)
  );
}

function applyFilters(httpParams: HttpParams, filters: FilterMap): HttpParams {
  for (const [field, value] of Object.entries(filters)) {
    if (value == null) {
      httpParams = httpParams.set(field, 'null');
      continue;
    }

    if (isOperatorObject(value)) {
      // Filtre avec opérateur(s) : { price: { gte: 10, lte: 100 } }
      for (const [op, opValue] of Object.entries(value)) {
        if (opValue == null) continue;

        const paramKey = op === 'eq' ? field : `${field}_${op}`;

        if (Array.isArray(opValue)) {
          // in: [1, 3, 5] → category_in=1,3,5
          httpParams = httpParams.set(paramKey, opValue.join(','));
        } else {
          httpParams = httpParams.set(paramKey, String(opValue));
        }
      }
    } else {
      // Filtre simple : { status: 'active' }
      httpParams = httpParams.set(field, String(value));
    }
  }

  return httpParams;
}
