import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';
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

  /** `true` si le chargement des inscriptions a réellement échoué (pas le cas « aucune édition active »). */
  protected readonly loadFailed = signal(false);

  /**
   * Partitionne sur l'année de l'édition active plutôt que sur `registration.edition.isActive` :
   * cette dernière est un flag indépendant qui peut diverger de `activeEdition()` (celle
   * réellement affichée par la carte), auquel cas une inscription risquait de n'apparaître dans
   * aucune des deux listes. Partitionner sur la même source rend les deux listes complémentaires.
   */
  protected readonly currentRegistration = computed<RegistrationSummary | null>(() => {
    const edition = this.activeEdition();
    if (edition === null) {
      return null;
    }
    return (
      this.registrations().find((registration) => registration.edition.year === edition.year) ??
      null
    );
  });

  /**
   * `findByExhibitor` trie les éditions par année croissante côté back ; l'historique se lit de
   * la plus récente à la plus ancienne, d'où le tri inverse ici plutôt qu'une modification de
   * l'API. `filter` renvoyant déjà un nouveau tableau, `sort` ne mute pas le signal.
   */
  protected readonly pastRegistrations = computed<RegistrationSummary[]>(() => {
    const activeYear = this.activeEdition()?.year ?? null;
    return this.registrations()
      .filter((registration) => registration.edition.year !== activeYear)
      .sort((a, b) => b.edition.year.localeCompare(a.edition.year));
  });

  constructor() {
    forkJoin({
      registrations: this.registrationService.getMine().pipe(map((response) => response.data)),
      // `GET /editions/active` répond 500 (et non `data: null`) quand aucune édition n'est
      // marquée active, car le back passe `null` à un paramètre non nullable. On dégrade vers
      // `null` plutôt que de laisser échouer tout le `forkJoin` : la carte affiche déjà ce cas
      // (« Aucune édition n'est ouverte actuellement »), et perdre l'historique de l'exposant
      // pour une simple absence d'édition active serait pire que l'erreur elle-même.
      activeEdition: this.editionService.getActive().pipe(
        map((response) => response.data),
        catchError(() => of(null)),
      ),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ registrations, activeEdition }) => {
          this.registrations.set(registrations);
          this.activeEdition.set(activeEdition);
        },
        error: () => this.loadFailed.set(true),
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
