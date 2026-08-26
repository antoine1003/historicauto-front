import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { CaptchaChallenge, CaptchaPayload } from '@app/shared/models/captcha.model';
import { CaptchaService } from '@app/shared/services/captcha.service';

/**
 * Question de vérification anti-robot, partagée par /contact et /register.
 *
 * Le composant porte aussi le honeypot : les pages hôtes posent une balise et n'ont rien à savoir
 * du piège, si bien qu'un futur formulaire en hérite sans effort.
 *
 * Il n'emploie que les classes de `core/styles/auth.theme.css`, déjà utilisées par les deux pages :
 * il est donc cohérent partout sans ajouter une ligne de CSS globale — ce qui compte, le budget
 * `anyComponentStyle` d'Angular étant à 8 ko et `public.theme.css` en pesant déjà 6,1.
 */
@Component({
  selector: 'app-captcha-field',
  standalone: true,
  imports: [FormsModule, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './captcha-field.component.html',
  styles: [
    `
      .captcha-honeypot {
        position: absolute;
        left: -9999px;
        width: 1px;
        height: 1px;
        overflow: hidden;
        opacity: 0;
        pointer-events: none;
      }
    `,
  ],
})
export class CaptchaFieldComponent {
  private readonly captchaService = inject(CaptchaService);

  protected readonly challenge = signal<CaptchaChallenge | null>(null);
  protected readonly answer = signal('');
  protected readonly website = signal('');
  protected readonly touched = signal(false);
  protected readonly loadFailed = signal(false);

  /**
   * Charge utile à fusionner dans la requête, ou `null` si le défi n'est pas chargé ou la réponse
   * vide. La justesse de la réponse n'est jamais évaluée ici : seul le serveur la connaît.
   */
  readonly payload = computed<CaptchaPayload | null>(() => {
    const challenge = this.challenge();
    const answer = this.answer().trim();
    if (challenge === null || answer.length === 0) {
      return null;
    }
    return { captchaId: challenge.id, captchaAnswer: answer, website: this.website() };
  });

  protected readonly error = computed<string | null>(() => {
    if (this.loadFailed()) {
      return 'Impossible de charger la question de vérification.';
    }
    if (this.touched() && this.payload() === null) {
      return 'Merci de répondre à la question de vérification.';
    }
    return null;
  });

  constructor() {
    this.refresh();
  }

  /**
   * Recharge un défi et vide la réponse saisie.
   *
   * À appeler après tout rejet du serveur : le back brûle le défi dès la première vérification,
   * juste ou fausse, donc la question affichée est morte quoi qu'il arrive.
   */
  refresh(): void {
    this.challenge.set(null);
    this.answer.set('');
    this.touched.set(false);
    this.loadFailed.set(false);
    this.captchaService.fetch().subscribe({
      next: (challenge) => this.challenge.set(challenge),
      error: () => this.loadFailed.set(true),
    });
  }

  /** Fait apparaître l'erreur du champ, comme les `xxxTouched.set(true)` des pages hôtes. */
  markTouched(): void {
    this.touched.set(true);
  }
}
