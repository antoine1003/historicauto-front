import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';
import { APP_VERSION } from '@app/core/app-version';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-public-footer',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="ha-footer">
      <div class="ha-container">
        <div class="ha-footer-grid">
          <div>
            <p class="ha-footer-title">Historic Auto</p>
            <address class="ha-footer-text">
              5 bis avenue de l'Europe<br />
              44260 La Montagne
            </address>
          </div>

          <div>
            <p class="ha-footer-title">Espace exposant</p>
            <a routerLink="/" class="ha-footer-link">Accueil</a>
            <a routerLink="/contact" class="ha-footer-link">Contact</a>
            @if (auth.isInitialized() && !auth.isAuthenticated()) {
              <a routerLink="/login" class="ha-footer-link">Connexion</a>
              <a routerLink="/register" class="ha-footer-link">Créer un compte</a>
            }
          </div>

          <div>
            <p class="ha-footer-title">Nous écrire</p>
            <a [href]="'mailto:' + contactEmail" class="ha-footer-link">{{ contactEmail }}</a>
            <a
              href="https://www.historic-auto.com"
              target="_blank"
              rel="noopener"
              class="ha-footer-link"
            >
              Site officiel du salon
            </a>
          </div>
        </div>

        <p class="ha-footer-bottom">© {{ currentYear }} Historic Auto — Espace exposant · v{{ appVersion }}</p>
      </div>
    </footer>
  `,
})
export class PublicFooterComponent {
  protected readonly auth = inject(AuthService);
  protected readonly contactEmail = environment.contactEmail;
  protected readonly currentYear = new Date().getFullYear();
  protected readonly appVersion = APP_VERSION;
}
