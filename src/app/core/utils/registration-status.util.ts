import { RegistrationStatus } from '@app/core/models/registration.model';

/**
 * Sous-ensemble des severities PrimeNG utilisées ici (cf. `p-tag` de l'étape Documents).
 */
export type RegistrationStatusSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

/**
 * Statut tel qu'affiché dans « Mon Espace ».
 *
 * `not-started` n'existe pas côté back : il traduit l'absence de Registration pour l'édition
 * active, le brouillon n'étant créé qu'au premier accès au formulaire (get-or-create de
 * `/registrations/by-edition-year/{year}`).
 */
export type DisplayRegistrationStatus = RegistrationStatus | 'not-started';

const LABELS: Record<DisplayRegistrationStatus, string> = {
  'not-started': 'Pas commencée',
  draft: 'Brouillon',
  submitted: 'Envoyée — en cours d\'étude',
  accepted: 'Acceptée',
  waitlisted: 'Liste d\'attente',
  refused: 'Refusée',
  confirmed: 'Confirmée',
  completed: 'Terminée',
};

const SEVERITIES: Record<DisplayRegistrationStatus, RegistrationStatusSeverity> = {
  'not-started': 'secondary',
  draft: 'info',
  submitted: 'info',
  accepted: 'success',
  waitlisted: 'warn',
  refused: 'danger',
  confirmed: 'success',
  completed: 'success',
};

export function statusLabel(status: DisplayRegistrationStatus): string {
  return LABELS[status];
}

export function statusSeverity(status: DisplayRegistrationStatus): RegistrationStatusSeverity {
  return SEVERITIES[status];
}
