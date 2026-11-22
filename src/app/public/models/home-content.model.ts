export interface HomeStat {
  readonly value: string;
  readonly label: string;
}

/** Contenu de la page d'accueil, administré par le Super Admin (`GET /api/home-content`). */
export interface HomeContent {
  readonly heroEyebrow: string;
  readonly heroTitle: string;
  readonly heroLead: string;
  /**
   * Logo Historic Auto administré : affiché en haut de l'accueil ET dans l'en-tête de toutes les
   * pages. URL absolue sur le back, ou null : on garde alors `DEFAULT_LOGO_URL`.
   */
  readonly heroImageUrl: string | null;
  readonly heroImageAlt: string;
  readonly bandDate: string;
  readonly bandLocation: string;
  readonly bandSubtitle: string;
  readonly stats: readonly HomeStat[];
  /** URL absolue sur le back, ou null : la page garde alors `/images/salon.jpg`. */
  readonly salonImageUrl: string | null;
  readonly salonImageAlt: string;
  readonly stepsTitle: string;
  readonly stepsLead: string;
  readonly ctaTitle: string;
  readonly ctaTextGuest: string;
  readonly ctaTextMember: string;
}

/**
 * Contenu d'origine, identique à la fiche créée par la migration du back. Sert à réserver la place
 * pendant le chargement (texte invisible) et s'affiche si l'API ne répond pas.
 */
export const DEFAULT_HOME_CONTENT: HomeContent = {
  heroEyebrow: 'Espace exposant',
  heroTitle: 'Réservez votre stand pour la 6e édition',
  heroLead:
    'Historic Auto ouvre son espace en ligne aux exposants. Constituez votre dossier à votre rythme — entité, stand et options, devis, documents, paiement — et suivez son avancement à tout moment.',
  heroImageUrl: null,
  heroImageAlt: 'Logo Historic Auto',
  bandDate: 'Février 2028',
  bandLocation: 'Nantes, Parc des Expositions',
  bandSubtitle: '6e édition du salon du véhicule de collection',
  stats: [
    { value: '40 000', label: 'visiteurs' },
    { value: '330', label: 'exposants' },
    { value: '27 000 m²', label: 'de surface' },
    { value: '30', label: 'expositions thématiques' },
  ],
  salonImageUrl: null,
  salonImageAlt: "Vue d'ensemble des allées du salon Historic Auto",
  stepsTitle: 'Comment ça marche',
  stepsLead:
    "Votre demande de stand se construit en cinq étapes. Vous pouvez l'interrompre et la reprendre quand vous le souhaitez : votre saisie est enregistrée au fur et à mesure.",
  ctaTitle: 'Prêt à déposer votre demande ?',
  ctaTextGuest:
    "La création de compte prend moins d'une minute. Vous pourrez ensuite commencer votre dossier et le compléter quand vous le souhaitez.",
  ctaTextMember: "Reprenez votre dossier là où vous l'avez laissé.",
};

/** Logo d'origine, livré avec le front : utilisé tant qu'aucun logo n'est administré. */
export const DEFAULT_LOGO_URL = '/images/logo.webp';
