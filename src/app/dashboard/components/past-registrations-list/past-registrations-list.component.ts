import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { RegistrationSummary } from '@app/core/models/registration.model';
import { statusLabel, statusSeverity } from '@app/core/utils/registration-status.util';

/**
 * Historique des éditions auxquelles l'exposant a déjà participé.
 *
 * Composant de présentation pur. Le tri est de la responsabilité de l'appelant : la page envoie
 * la liste déjà ordonnée par année décroissante.
 */
@Component({
  selector: 'app-past-registrations-list',
  standalone: true,
  imports: [ButtonModule, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './past-registrations-list.component.html',
})
export class PastRegistrationsListComponent {
  readonly registrations = input.required<RegistrationSummary[]>();

  /** Émet l'année de l'édition que l'exposant veut consulter. */
  readonly consult = output<string>();

  protected readonly statusLabel = statusLabel;
  protected readonly statusSeverity = statusSeverity;
}
