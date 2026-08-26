/** Défi servi par `GET /api/captcha`. La réponse attendue n'y figure jamais. */
export interface CaptchaChallenge {
  id: string;
  question: string;
}

/** Ce que le formulaire ajoute à sa charge utile pour être accepté par le back. */
export interface CaptchaPayload {
  captchaId: string;
  captchaAnswer: string;
  /**
   * Honeypot. Toujours vide chez un humain : le champ est hors écran et retiré de l'arbre
   * d'accessibilité. S'il est rempli, le back répond « succès » et n'envoie rien.
   */
  website: string;
}
