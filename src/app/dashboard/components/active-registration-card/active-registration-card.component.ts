import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { RegistrationSummary } from '@app/core/models/registration.model';
import { Edition } from '@app/shared/models/edition.interface';
import {
  DisplayRegistrationStatus,
  RegistrationStatusSeverity,
  statusLabel,
  statusSeverity,
} from '@app/core/utils/registration-status.util';

/**
 * Carte de la demande d'inscription pour l'édition active.
 *
 * Composant de présentation pur : il ne charge rien et ne navigue pas lui-même. La page lui
 * passe l'édition active et l'inscription correspondante — `null` si l'exposant n'a jamais
 * ouvert le formulaire — et écoute `consult` pour déclencher la navigation.
 */
@Component({
  selector: 'app-active-registration-card',
  standalone: true,
  imports: [ButtonModule, Card, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './active-registration-card.component.html',
})
export class ActiveRegistrationCardComponent {
  readonly edition = input.required<Edition | null>();
  readonly registration = input.required<RegistrationSummary | null>();

  /** Émis quand l'exposant veut ouvrir le formulaire de l'édition active. */
  readonly consult = output<void>();

  protected readonly status = computed<DisplayRegistrationStatus>(
    () => this.registration()?.status ?? 'not-started',
  );

  protected readonly label = computed<string>(() => statusLabel(this.status()));

  protected readonly severity = computed<RegistrationStatusSeverity>(() =>
    statusSeverity(this.status()),
  );

  /**
   * Libellé du bouton, ou `null` quand aucun bouton ne doit s'afficher.
   *
   * Deux garde-fous dictés par le comportement réel de l'API :
   * - une édition masquée par HA (`isVisible = false`) renvoie un 404 sur
   *   `/registrations/by-edition-year/{year}` — on n'y envoie personne ;
   * - tant qu'aucune Registration n'existe, le get-or-create répond 403 si les inscriptions
   *   sont fermées — le bouton « Commencer » n'a donc de sens que si `registrationOpen`.
   */
  protected readonly actionLabel = computed<string | null>(() => {
    const edition = this.edition();
    if (!edition || !edition.isVisible) {
      return null;
    }

    const registration = this.registration();
    if (registration === null) {
      return edition.registrationOpen ? 'Commencer mon inscription' : null;
    }

    switch (registration.status) {
      case 'draft':
        return 'Reprendre mon formulaire';
      case 'submitted':
      case 'waitlisted':
      case 'refused':
        return 'Consulter mon dossier';
      default:
        return 'Accéder à mon dossier';
    }
  });

  /** Phrase indiquant la prochaine action attendue, ou `null` si le statut n'en appelle aucune. */
  protected readonly message = computed<string | null>(() => {
    const edition = this.edition();
    if (!edition) {
      return null;
    }

    const registration = this.registration();
    if (registration === null) {
      return edition.registrationOpen
        ? `Les inscriptions sont ouvertes pour l'édition ${edition.year}.`
        : null;
    }

    switch (registration.status) {
      case 'draft':
        return 'Votre formulaire est enregistré mais pas encore envoyé.';
      case 'submitted':
        return 'Nous étudions votre demande. Vous serez notifié par email.';
      case 'accepted':
        return 'Votre demande est acceptée — il reste à confirmer votre participation et signer votre devis.';
      case 'confirmed':
      case 'completed':
        return 'Votre inscription est confirmée.';
      default:
        return null;
    }
  });

  /**
   * Commentaire saisi par HA au refus ou à la mise en liste d'attente (cf. cahier des charges,
   * STEP 3). Volontairement borné à ces deux statuts : `refusalComment` n'a pas de sens ailleurs.
   */
  protected readonly refusalComment = computed<string | null>(() => {
    const registration = this.registration();
    if (registration === null) {
      return null;
    }

    return registration.status === 'refused' || registration.status === 'waitlisted'
      ? registration.refusalComment
      : null;
  });

  protected readonly isRefused = computed<boolean>(
    () => this.registration()?.status === 'refused',
  );

  protected readonly registrationsClosed = computed<boolean>(() => {
    const edition = this.edition();
    return edition !== null && (!edition.isVisible || !edition.registrationOpen);
  });
}
