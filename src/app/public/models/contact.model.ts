import { CaptchaPayload } from '@app/shared/models/captcha.model';

/** Motif du message, choisi dans la liste déroulante du formulaire de contact. */
export type ContactSubject = 'stand' | 'demande' | 'facturation' | 'autre';

/** Charge utile envoyée par le formulaire de contact. */
export interface ContactRequest extends CaptchaPayload {
  name: string;
  email: string;
  subject: ContactSubject;
  message: string;
}
