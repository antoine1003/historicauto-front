import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RegistrationSummary } from '@app/core/models/registration.model';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '@app/core/models/api.models';
import {
  CheckoutSessionApiDto,
  ConfirmationPayload,
  EntityStepApiDto,
  RegistrationDetailApiDto,
  StandManagerApiDto,
  StandStepApiDto,
  StructureAttachmentApiDto,
} from '@app/dashboard/models/registration-api.models';
import {
  EntityStepPayload,
  NewManagerPayload,
  StandStepPayload,
} from '@app/dashboard/models/edition-form.models';

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

  /**
   * Get-or-create du brouillon d'inscription de l'exposant connecté pour l'édition donnée.
   */
  getByEditionYear(year: string): Observable<ApiResponse<RegistrationDetailApiDto>> {
    return this.http.get<ApiResponse<RegistrationDetailApiDto>>(
      `${environment.apiUrl}/${this.baseUrl}/by-edition-year/${year}`,
    );
  }

  patchEntity(id: string, body: Partial<EntityStepPayload>): Observable<ApiResponse<EntityStepApiDto>> {
    return this.http.patch<ApiResponse<EntityStepApiDto>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/entity`,
      body,
    );
  }

  patchStand(id: string, body: StandStepPayload): Observable<ApiResponse<StandStepApiDto>> {
    return this.http.patch<ApiResponse<StandStepApiDto>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/stand`,
      body,
    );
  }

  addManager(id: string, body: NewManagerPayload): Observable<ApiResponse<StandManagerApiDto>> {
    return this.http.post<ApiResponse<StandManagerApiDto>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/managers`,
      body,
    );
  }

  removeManager(id: string, managerId: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/managers/${managerId}`,
    );
  }

  uploadLogo(id: string, file: File): Observable<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ApiResponse<{ url: string }>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/logo`,
      formData,
    );
  }

  uploadStructureAttachment(id: string, file: File): Observable<ApiResponse<StructureAttachmentApiDto>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ApiResponse<StructureAttachmentApiDto>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/structure/attachments`,
      formData,
    );
  }

  deleteStructureAttachment(id: string, attachmentId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/structure/attachments/${attachmentId}`,
    );
  }

  submit(id: string): Observable<ApiResponse<{ status: string }>> {
    return this.http.post<ApiResponse<{ status: string }>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/submit`,
      {},
    );
  }

  confirmRegistration(id: string, payload: ConfirmationPayload): Observable<ApiResponse<RegistrationDetailApiDto>> {
    return this.http.post<ApiResponse<RegistrationDetailApiDto>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/confirm`,
      payload,
    );
  }

  createPaymentCheckoutSession(id: string): Observable<ApiResponse<CheckoutSessionApiDto>> {
    return this.http.post<ApiResponse<CheckoutSessionApiDto>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/payment/checkout-session`,
      {},
    );
  }
}
