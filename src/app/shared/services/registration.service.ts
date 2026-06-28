import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RegistrationSummary } from '@app/core/models/registration.model';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '@app/core/models/api.models';

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'registrations';

  /**
   * Retourne l'inscription liée à l'édition active (s'il y en a une déjà
   * démarrée) et l'historique des éditions passées de l'exposant connecté.
   */
  getMine(): Observable<ApiResponse<RegistrationSummary[]>> {
    return this.http.get<ApiResponse<RegistrationSummary[]>>(`${environment.apiUrl}/${this.baseUrl}/mine`);
  }
}
