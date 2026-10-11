import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '@app/core/models/api.models';

/**
 * Années proposées dans « Vous étiez présent en » (administrées dans EasyAdmin), de la plus
 * ancienne à la plus récente. Même cache que ActivityDomainService.
 */
@Injectable({ providedIn: 'root' })
export class PastEditionService {
  private readonly http = inject(HttpClient);
  private cached: Observable<string[]> | null = null;

  getAll(): Observable<string[]> {
    if (!this.cached) {
      this.cached = this.http
        .get<ApiResponse<string[]>>(`${environment.apiUrl}/past-editions`)
        .pipe(
          map((res) => res.data),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }

    return this.cached;
  }
}
