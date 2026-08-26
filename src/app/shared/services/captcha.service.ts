import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CaptchaChallenge } from '@app/shared/models/captcha.model';
import { environment } from '../../../environments/environment';

/** Récupère une question de vérification auprès du back. */
@Injectable({ providedIn: 'root' })
export class CaptchaService {
  private readonly http = inject(HttpClient);

  fetch(): Observable<CaptchaChallenge> {
    return this.http.get<CaptchaChallenge>(`${environment.apiUrl}/captcha`);
  }
}
