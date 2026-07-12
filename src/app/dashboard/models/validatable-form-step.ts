/**
 * Contrat des étapes du formulaire dont la progression est bloquée par une validation
 * (Entité, Stand). Les étapes sans contrainte de validation (Confirmation gère sa propre
 * checklist, Documents, Paiement) n'ont pas à l'implémenter.
 */
export interface ValidatableFormStep {
  /** Révèle les erreurs de validation et retourne true si l'étape peut être quittée. */
  validateAndTouch(): boolean;
}
