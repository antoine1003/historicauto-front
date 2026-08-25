import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { ContactRequest } from '@app/public/models/contact.model';

/**
 * Envoi du formulaire de contact.
 *
 * L'endpoint back n'existe pas encore : `send()` simule aujourd'hui une réponse réussie après
 * un court délai, ce qui permet au composant de gérer dès maintenant ses trois états.
 *
 * Cette méthode est la seule frontière à modifier le jour où le back est disponible :
 * injecter `HttpClient`, importer `environment`, et remplacer le corps par l'appel commenté.
 * Le composant n'a pas à changer.
 */
@Injectable({ providedIn: 'root' })
export class ContactService {
  send(payload: ContactRequest): Observable<void> {
    // TODO(back) : remplacer par
    // return this.http.post<void>(`${environment.apiUrl}/contact`, payload);
    return of(void 0).pipe(delay(600));
  }
}
