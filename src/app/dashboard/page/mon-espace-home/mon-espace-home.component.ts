import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { RegistrationSummary } from '@app/core/models/registration.model';
import { Edition } from '@app/shared/models/edition.interface';
import { EditionService } from '@app/shared/services/edition.service';
import { RegistrationService } from '@app/shared/services/registration.service';
import {
  ActiveRegistrationCardComponent,
} from '@app/dashboard/components/active-registration-card/active-registration-card.component';
import {
  PastRegistrationsListComponent,
} from '@app/dashboard/components/past-registrations-list/past-registrations-list.component';
import { environment } from '../../../../environments/environment';

/**
 * Point d'entrée de l'espace exposant.
 *
 * Seul composant de la page à charger des données : il calcule la demande de l'édition active
 * et l'historique, puis délègue tout l'affichage à deux composants de présentation.
 */
@Component({
  selector: 'app-mon-espace-home',
  standalone: true,
  imports: [ActiveRegistrationCardComponent, PastRegistrationsListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mon-espace-home.component.html',
})
export class MonEspaceHomeComponent {
  private readonly registrationService = inject(RegistrationService);
  private readonly editionService = inject(EditionService);
  private readonly router = inject(Router);

  private readonly registrations = signal<RegistrationSummary[]>([]);

  protected readonly loading = signal(true);
  protected readonly activeEdition = signal<Edition | null>(null);
  protected readonly contactEmail = environment.contactEmail;

  protected readonly currentRegistration = computed<RegistrationSummary | null>(
    () => this.registrations().find((registration) => registration.edition.isActive) ?? null,
  );

  /**
   * `findByExhibitor` trie les éditions par année croissante côté back ; l'historique se lit de
   * la plus récente à la plus ancienne, d'où le tri inverse ici plutôt qu'une modification de
   * l'API. `filter` renvoyant déjà un nouveau tableau, `sort` ne mute pas le signal.
   */
  protected readonly pastRegistrations = computed<RegistrationSummary[]>(() =>
    this.registrations()
      .filter((registration) => !registration.edition.isActive)
      .sort((a, b) => b.edition.year.localeCompare(a.edition.year)),
  );

  constructor() {
    forkJoin({
      mineResp: this.registrationService.getMine(),
      activeEditionResp: this.editionService.getActive(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ mineResp, activeEditionResp }) => {
        this.registrations.set(mineResp.data);
        this.activeEdition.set(activeEditionResp.data);
      });
  }

  protected goToEdition(year: string): void {
    void this.router.navigate(['/edition', year]);
  }

  protected goToActiveEdition(): void {
    const edition = this.activeEdition();
    if (edition !== null) {
      this.goToEdition(edition.year);
    }
  }
}
