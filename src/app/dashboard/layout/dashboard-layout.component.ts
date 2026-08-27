import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PublicHeaderComponent } from '@app/public/layout/public-header.component';
import { PublicFooterComponent } from '@app/public/layout/public-footer.component';

/**
 * Enveloppe des routes connectées. Compose les mêmes briques que PublicLayoutComponent plutôt que
 * de le réutiliser tel quel : l'espace exposant recevra des éléments propres (bandeau d'édition,
 * indicateur de progression) qui n'ont rien à faire sur le site public.
 */
@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, PublicHeaderComponent, PublicFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pub-shell">
      <app-public-header />
      <main class="pub-main">
        <router-outlet />
      </main>
      <app-public-footer />
    </div>
  `,
})
export class DashboardLayoutComponent {}
