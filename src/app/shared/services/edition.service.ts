import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '@app/core/models/api.models';
import { Edition } from '@app/shared/models/edition.interface';

@Injectable({ providedIn: 'root' })
export class EditionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'editions';

  /**
   * Retourne l'inscription liée à l'édition active (s'il y en a une déjà
   * démarrée) et l'historique des éditions passées de l'exposant connecté.
   */
  getActive(): Observable<ApiResponse<Edition>> {
    return this.http.get<ApiResponse<Edition>>(`${environment.apiUrl}/${this.baseUrl}/active`);
  }
}
