import { HttpBackend, HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of, timeout } from 'rxjs';
import { DEFAULT_HOME_CONTENT, HomeContent } from '@app/public/models/home-content.model';
import { environment } from '../../../environments/environment';

/** Délai au-delà duquel la page renonce à l'API et affiche son contenu d'origine. */
const LOAD_TIMEOUT_MS = 4000;

/**
 * Contenu de la page d'accueil. Lecture publique : le client passe par `HttpBackend` pour échapper
 * à `authInterceptor`, sans quoi un jeton expiré resté en stockage ferait répondre 401 au pare-feu
 * JWT et le visiteur verrait le contenu d'origine au lieu du contenu administré.
 */
@Injectable({ providedIn: 'root' })
export class HomeContentService {
  private readonly http = new HttpClient(inject(HttpBackend));

  /** Ne lève jamais : en cas d'échec ou de lenteur, renvoie le contenu d'origine. */
  get(): Observable<HomeContent> {
    return this.http.get<HomeContent>(`${environment.apiUrl}/home-content`).pipe(
      timeout(LOAD_TIMEOUT_MS),
      catchError(() => of(DEFAULT_HOME_CONTENT)),
    );
  }
}
