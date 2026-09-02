import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PublicHeaderComponent } from '@app/public/layout/public-header.component';
import { PublicFooterComponent } from '@app/public/layout/public-footer.component';

/**
 * Enveloppe des routes d'authentification. Compose les mêmes briques que PublicLayoutComponent et
 * DashboardLayoutComponent : ces pages faisaient jusqu'ici exception, sans en-tête ni pied de page.
 *
 * `pub-main` reçoit `flex` pour que le `flex-1` de `.auth-shell` ait un axe où s'étirer, et que la
 * carte se centre dans la hauteur restante plutôt que de pousser le pied de page hors de l'écran.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet, PublicHeaderComponent, PublicFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pub-shell">
      <app-public-header />
      <main class="pub-main flex">
        <div class="auth-shell">
          <router-outlet />
        </div>
      </main>
      <app-public-footer />
    </div>
  `,
})
export class AuthLayoutComponent {}
