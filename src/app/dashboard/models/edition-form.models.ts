import { DocumentType, SignatureStatus } from '@app/core/models/document.model';

/**
 * Miroir front des enums Symfony (App\Enum\ExhibitorType, ClubType, RegistrationStatus).
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

export enum OptionInputType {
  RADIO = 'radio',
  CHECKBOX = 'checkbox',
  NUMBER = 'number',
}

export enum OptionQuantitySource {
  FIXED_ONE = 'fixed_one',
  USER_INPUT = 'user_input',
  STAND_SURFACE_SQM = 'stand_surface_sqm',
  PARTITION_LENGTH = 'partition_length',
}

export enum OptionGroupBehaviour {
  NONE = 'none',
  SURFACE = 'surface',
  PARTITION = 'partition',
}

export enum PartitionLayout {
  BACK = 'back',
  ANGLE = 'angle',
  U = 'u',
}

export const PARTITION_LAYOUT_LABELS: Record<PartitionLayout, string> = {
  [PartitionLayout.BACK]: 'Cloison de fond',
  [PartitionLayout.ANGLE]: 'Cloisons en angle',
  [PartitionLayout.U]: 'Cloisons en U',
};

/** Nombre de longueurs à saisir par disposition. Miroir de PartitionLayout::segmentCount(). */
export const PARTITION_SEGMENT_COUNTS: Record<PartitionLayout, number> = {
  [PartitionLayout.BACK]: 1,
  [PartitionLayout.ANGLE]: 2,
  [PartitionLayout.U]: 3,
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
  /** UUID serveur une fois créé côté back ; id temporaire `temp-<uuid>` pendant l'ajout optimiste. */
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
  /** Uniquement pertinent si exhibitorType === PRO. UUID d'ActivityDomain, résolu via ActivityDomainService. */
  activityDomainId: string | null;
  /** Uniquement pertinent si exhibitorType === CLUB. */
  clubType: ClubType | null;
  visualUrl: string | null;
  managers: StandManagerForm[];
}

/** Une option commandable, telle que renvoyée dans sa section par GET /editions/{year}/option-prices. */
export interface OptionDefinition {
  id: string;
  label: string;
  unit: string | null;
  /** Renseigné uniquement pour les packs d'un groupe de comportement SURFACE. */
  surfaceSqm: number | null;
  includedBadges: number | null;
  priceTtc: number;
  vatRate: number;
  sortOrder: number;
}

/**
 * Section du formulaire d'options. Le type d'input, le caractère obligatoire et la source de
 * quantité sont réglés en administration : le front n'en code aucun en dur.
 */
export interface OptionGroupDefinition {
  code: string;
  label: string;
  helpText: string | null;
  inputType: OptionInputType;
  isRequired: boolean;
  quantitySource: OptionQuantitySource;
  behaviour: OptionGroupBehaviour;
  sortOrder: number;
  collapsedByDefault: boolean;
  options: OptionDefinition[];
}

export interface PartitionDetailForm {
  layout: PartitionLayout;
  /** Longueurs en mètres, de taille PARTITION_SEGMENT_COUNTS[layout]. */
  segments: number[];
  usageNotes: string | null;
}

/** Ligne de commande déjà chiffrée par le serveur — le front n'effectue aucun calcul de prix. */
export interface StandLine {
  optionId: string;
  groupCode: string;
  groupLabel: string;
  label: string;
  unit: string | null;
  quantity: number;
  unitPriceTtc: number;
  lineTotalTtc: number;
  vatRate: number;
  partition: PartitionDetailForm | null;
}

export interface StandStepState {
  /** Quantité retenue par identifiant d'option. Une option absente n'est pas commandée. */
  selections: Record<string, number>;
  partition: PartitionDetailForm | null;
  lines: StandLine[];
  totalTtc: number;
  totalVat: number;
  depositTtc: number;
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

export interface DocumentItem {
  id: string;
  kind: DocumentType;
  label: string;
  /** Un document n'est affiché à l'exposant que si HA l'a rendu visible dans le dashboard. */
  visible: boolean;
  fileUrl: string | null;
  /** Lien de signature hébergé Docuseal, non nul uniquement pour un devis envoyé en signature. */
  signingUrl: string | null;
  signatureStatus: SignatureStatus;
  uploadedAt: Date | null;
}

export interface PaymentItem {
  id: string;
  amountTtc: number;
  method: string;
  paidAt: Date;
  label: string | null;
}

/**
 * Prestation facturée en supplément, saisie par HA en administration. Affichée uniquement dans le
 * récapitulatif de l'étape Paiement, jamais dans le récapitulatif des options du stand.
 */
export interface ExtraOptionItem {
  id: string;
  label: string;
  quantity: number;
  unitPriceTtc: number;
  lineTotalTtc: number;
}

export interface PaymentSummary {
  standTotalTtc: number;
  discountPercent: number;
  fileFeeTtc: number;
  depositRatePercent: number;
  extraOptions: ExtraOptionItem[];
  balanceDueDate: Date | null;
  bankIban: string | null;
  bankBic: string | null;
  nextCardPaymentAmountTtc: number;
  payments: PaymentItem[];
}

/** État complet d'un formulaire d'inscription pour une édition donnée. */
export interface EditionRegistrationState {
  /** UUID de la Registration côté back — requis par tous les endpoints de mutation. */
  id: string;
  editionYear: string;
  /** Id réel de la Registration côté back, résolu de façon asynchrone via RegistrationService.getMine(). */
  registrationId: string | null;
  status: RegistrationStatus;
  /** Verrouillé dès que le statut quitte DRAFT, quelle qu'en soit la raison (cf. editionClosed pour la distinguer). */
  readOnly: boolean;
  /** true uniquement si l'édition n'est plus active/ouverte — distingue "édition passée" de "déjà soumis". */
  editionClosed: boolean;
  entity: EntityStepState;
  stand: StandStepState;
  confirmation: ConfirmationStepState;
  documents: DocumentItem[];
  payment: PaymentSummary;
}

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'pending';

// ── Payloads envoyés à l'API ──

export interface EntityStepPayload {
  exhibitorType: ExhibitorType;
  companyName: string;
  siret: string | null;
  activityDomainId: string | null;
  clubType: ClubType | null;
}

export interface StandStepPayload {
  /** `null` pour les groupes à quantité dérivée : le serveur la recalcule de toute façon. */
  selections: Record<string, number | null>;
  partition: PartitionDetailForm | null;
}

export interface NewManagerPayload {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
}
