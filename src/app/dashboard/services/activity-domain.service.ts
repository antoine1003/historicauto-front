import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '@app/core/models/api.models';
import { ActivityDomainApiDto } from '../models/registration-api.models';

@Injectable({ providedIn: 'root' })
export class ActivityDomainService {
  private readonly http = inject(HttpClient);
  private cached: Observable<ActivityDomainApiDto[]> | null = null;

  getAll(): Observable<ActivityDomainApiDto[]> {
    if (!this.cached) {
      this.cached = this.http
        .get<ApiResponse<ActivityDomainApiDto[]>>(`${environment.apiUrl}/activity-domains`)
        .pipe(
          map((res) => res.data),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }

    return this.cached;
  }
}
