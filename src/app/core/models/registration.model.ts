// src/app/features/mon-espace/models/registration.model.ts

/**
 * Reflète App\Enum\RegistrationStatus côté API.
 * Workflow : draft → submitted → accepted|refused|waitlisted → confirmed → completed
 */
export type RegistrationStatus =
  | 'draft'
  | 'submitted'
  | 'accepted'
  | 'refused'
  | 'waitlisted'
  | 'confirmed'
  | 'completed';

export interface EditionSummary {
  id: string;
  year: string;
  isActive: boolean;
  registrationOpen: boolean;
  isVisible: boolean;
}

export interface RegistrationSummary {
  id: string;
  edition: EditionSummary;
  status: RegistrationStatus;
  refusalComment: string | null;
}
