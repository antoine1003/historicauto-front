import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '@app/core/models/api.models';
import { PreviousStandDto } from '@app/dashboard/models/previous-stand.models';

/** Recherche des stands de l'édition précédente par nom (10 résultats au plus, `[]` sous 2 caractères). */
@Injectable({ providedIn: 'root' })
export class PreviousStandService {
  private readonly http = inject(HttpClient);

  search(q: string): Observable<PreviousStandDto[]> {
    return this.http
      .get<ApiResponse<PreviousStandDto[]>>(`${environment.apiUrl}/previous-stands`, { params: new HttpParams().set('q', q) })
      .pipe(map((res) => res.data));
  }
}
