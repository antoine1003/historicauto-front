import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DocumentSummary, SharedDocumentItem } from '@app/core/models/document.model';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '@app/core/models/api.models';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'registrations';

  getDocuments(registrationId: string): Observable<ApiResponse<DocumentSummary[]>> {
    return this.http.get<ApiResponse<DocumentSummary[]>>(
      `${environment.apiUrl}/${this.baseUrl}/${registrationId}/documents`,
    );
  }

  getSharedDocuments(editionYear: string): Observable<ApiResponse<SharedDocumentItem[]>> {
    return this.http.get<ApiResponse<SharedDocumentItem[]>>(
      `${environment.apiUrl}/editions/${editionYear}/shared-documents`,
    );
  }
}
