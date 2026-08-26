import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ContactRequest } from '@app/public/models/contact.model';
import { environment } from '../../../environments/environment';

/** Envoi du formulaire de contact. */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly http = inject(HttpClient);

  send(payload: ContactRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/contact`, payload);
  }
}
