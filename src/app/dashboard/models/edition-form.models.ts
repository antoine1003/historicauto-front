/**
 * Miroir front des enums Symfony (App\Enum\ExhibitorType, ClubType, OptionCategory, RegistrationStatus).
 * Garder ces valeurs strictement synchronisées avec le back : elles sont envoyées telles quelles à l'API.
 */
export enum ExhibitorType {
  PRO = 'pro',
  CLUB = 'club',
}

export enum ClubType {
  BRAND_MODEL = 'brand_model',
  GENERALIST = 'generalist',
}

export enum OptionCategory {
  SURFACE = 'surface',
  CARPET = 'carpet',
  PARTITION = 'partition',
  STORAGE = 'storage',
  ELECTRICITY = 'electricity',
  LIGHTING = 'lighting',
  BARRIER = 'barrier',
  ACCESS = 'access',
  STRUCTURE = 'structure',
}

export const OPTION_CATEGORY_LABELS: Record<OptionCategory, string> = {
  [OptionCategory.SURFACE]: 'Surface',
  [OptionCategory.CARPET]: 'Moquette',
  [OptionCategory.PARTITION]: 'Cloison',
  [OptionCategory.STORAGE]: 'Réserve',
  [OptionCategory.ELECTRICITY]: 'Électricité',
  [OptionCategory.LIGHTING]: 'Éclairage',
  [OptionCategory.BARRIER]: 'Barriérage',
  [OptionCategory.ACCESS]: 'Accès',
  [OptionCategory.STRUCTURE]: 'Barnum / Structure',
};

export enum RegistrationStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  REFUSED = 'refused',
  WAITLISTED = 'waitlisted',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
}

/** Identifiant des 5 étapes, dans l'ordre d'affichage du stepper. */
export enum RegistrationStep {
  ENTITY = 1,
  STAND = 2,
  CONFIRMATION = 3,
  DOCUMENTS = 4,
  PAYMENT = 5,
}

export interface StandManagerForm {
  /** Id local généré côté front (crypto.randomUUID), remplacé par l'UUID serveur après sauvegarde. */
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface EntityStepState {
  exhibitorType: ExhibitorType;
  companyName: string;
  /** Uniquement pertinent si exhibitorType === PRO. */
  siret: string | null;
  activityDomain: string | null;
  /** Uniquement pertinent si exhibitorType === CLUB. */
  clubType: ClubType | null;
  visualFileName: string | null;
  managers: StandManagerForm[];
}

/** Définition catalogue d'une option, en dur côté front (cf. recommandation plus bas pour les prix). */
export interface OptionDefinition {
  id: string;
  category: OptionCategory;
  label: string;
  unit: string | null;
  /** Renseigné uniquement pour les packs de la catégorie SURFACE. */
  includedBadges: number | null;
  /**
   * Prix TTC mocké. EN PRODUCTION : ne jamais coder le prix en dur.
   * Il doit être résolu via GET /api/editions/{year}/option-prices (table OptionEditionPrice),
   * le catalogue (id, label, catégorie, unité) restant lui en dur côté front comme demandé.
   */
  mockPriceTtc: number;
  mockVatRate: number;
}

export interface StandStepState {
  /** Pack de surface unique sélectionné (un seul stand par inscription). */
  selectedSurfaceOptionId: string | null;
  /** Quantité par option pour toutes les catégories hors SURFACE (0 = non sélectionnée). */
  quantitiesByOptionId: Record<string, number>;
}

export interface ConfirmationChecklistState {
  acknowledgedQuoteAndPricing: boolean;
  acceptedGeneralTerms: boolean;
  noSublease: boolean;
  noStandSharing: boolean;
  cleanupCommitment: boolean;
  respectLayout: boolean;
  readAndApproved: boolean;
}

export interface ConfirmationStepState {
  checklist: ConfirmationChecklistState;
  signatoryName: string;
  signatoryRole: string;
  /** Renseigné uniquement après confirmation effective (cf. RegistrationSignature côté back). */
  confirmedAt: Date | null;
}

export type DocumentKind = 'quote' | 'invoice' | 'insurance' | 'supplier_list' | 'ticket';

export interface DocumentItem {
  id: string;
  kind: DocumentKind;
  label: string;
  /** Un document n'est affiché à l'exposant que si HA l'a rendu visible dans le dashboard. */
  visible: boolean;
  fileUrl: string | null;
  signed: boolean;
  uploadedAt: Date | null;
}

export interface PaymentItem {
  id: string;
  amountTtc: number;
  method: string;
  paidAt: Date;
}

export interface PaymentSummary {
  standTotalTtc: number;
  discountPercent: number;
  fileFeeTtc: number;
  depositRatePercent: number;
  balanceDueDate: Date | null;
  payments: PaymentItem[];
}

/** État complet d'un formulaire d'inscription pour une édition donnée. */
export interface EditionRegistrationState {
  editionYear: string;
  status: RegistrationStatus;
  /** Une édition est verrouillée en lecture seule dès qu'elle n'est plus l'édition active d'inscription. */
  readOnly: boolean;
  entity: EntityStepState;
  stand: StandStepState;
  confirmation: ConfirmationStepState;
  documents: DocumentItem[];
  payment: PaymentSummary;
}

