import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '@app/core/models/api.models';
import { PreviousStandDto } from '@app/dashboard/models/previous-stand.models';

/**
 * Recherche des stands de l'édition précédente par nom (10 résultats au plus, `[]` sous 2 caractères).
 * Le back décide pour quelle édition d'inscription ces données valent (2028 seulement) : hors de
 * celle-ci il renvoie `[]`, et le champ se comporte comme un simple champ texte.
 */
@Injectable({ providedIn: 'root' })
export class PreviousStandService {
  private readonly http = inject(HttpClient);

  search(q: string, registrationEditionYear: string): Observable<PreviousStandDto[]> {
    const params = new HttpParams().set('q', q).set('edition', registrationEditionYear);
    return this.http
      .get<ApiResponse<PreviousStandDto[]>>(`${environment.apiUrl}/previous-stands`, { params })
      .pipe(map((res) => res.data));
  }
}
