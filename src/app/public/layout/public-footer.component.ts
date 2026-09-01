import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-public-footer',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="pub-footer">
      <div class="pub-container">
        <div class="pub-footer-grid">
          <div>
            <p class="pub-footer-title">Historic Auto</p>
            <address class="pub-footer-text">
              5 bis avenue de l'Europe<br />
              44260 La Montagne
            </address>
          </div>

          <div>
            <p class="pub-footer-title">Espace exposant</p>
            <a routerLink="/" class="pub-footer-link">Accueil</a>
            <a routerLink="/contact" class="pub-footer-link">Contact</a>
            @if (auth.isInitialized() && !auth.isAuthenticated()) {
              <a routerLink="/login" class="pub-footer-link">Connexion</a>
              <a routerLink="/register" class="pub-footer-link">Créer un compte</a>
            }
          </div>

          <div>
            <p class="pub-footer-title">Nous écrire</p>
            <a [href]="'mailto:' + contactEmail" class="pub-footer-link">{{ contactEmail }}</a>
            <a
              href="https://www.historic-auto.com"
              target="_blank"
              rel="noopener"
              class="pub-footer-link"
            >
              Site officiel du salon
            </a>
          </div>
        </div>

        <p class="pub-footer-bottom">© {{ currentYear }} Historic Auto — Espace exposant</p>
      </div>
    </footer>
  `,
})
export class PublicFooterComponent {
  protected readonly auth = inject(AuthService);
  protected readonly contactEmail = environment.contactEmail;
  protected readonly currentYear = new Date().getFullYear();
}
