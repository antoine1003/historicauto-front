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
  STRUCTURE = 'structure',
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

/**
 * Jeton d'URL de chaque étape (`/edition/:year?step=documents`), pour ouvrir le formulaire sur un
 * onglet précis depuis un lien d'email. DOIT rester identique à l'enum PHP
 * App\Enum\RegistrationFormStep côté back, qui construit ces liens.
 */
export const REGISTRATION_STEP_SLUGS: Readonly<Record<RegistrationStep, string>> = {
  [RegistrationStep.ENTITY]: 'entite',
  [RegistrationStep.STAND]: 'stand',
  [RegistrationStep.CONFIRMATION]: 'confirmation',
  [RegistrationStep.DOCUMENTS]: 'documents',
  [RegistrationStep.PAYMENT]: 'paiement',
};

/** Étape désignée par un jeton d'URL, `null` si absent ou inconnu (→ étape par défaut). */
export function registrationStepFromSlug(slug: string | null): RegistrationStep | null {
  if (!slug) {
    return null;
  }
  const match = Object.entries(REGISTRATION_STEP_SLUGS).find(([, value]) => value === slug.toLowerCase());
  return match ? (Number(match[0]) as RegistrationStep) : null;
}

export interface StandManagerForm {
  /** UUID serveur une fois créé côté back ; id temporaire `temp-<uuid>` pendant l'ajout optimiste. */
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

/** Responsable de l'entité : un seul par inscription, prénom, nom et email obligatoires. */
export interface EntityManagerForm {
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
  /** Nom du stand, facultatif, s'il diffère du nom de l'entité. Uniquement pertinent si exhibitorType === PRO. */
  standName: string | null;
  /** Uniquement pertinent si exhibitorType === PRO. UUIDs d'ActivityDomain, résolus via ActivityDomainService. */
  activityDomainIds: string[];
  /** Uniquement pertinent si exhibitorType === CLUB. */
  clubType: ClubType | null;
  visualUrl: string | null;
  entityManager: EntityManagerForm;
  /** « Vous étiez présent en » : `null` = pas encore répondu, `[]` = « Aucun ». */
  previousEditions: string[] | null;
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

/** Photo ou plan de barnum / structure déjà enregistré côté serveur. */
export interface StructureAttachment {
  id: string;
  originalName: string;
  mimeType: string | null;
  fileSize: number;
  /** URL absolue, ouverte dans un nouvel onglet. */
  url: string;
  createdAt: Date;
}

export interface StructureDetailForm {
  characteristics: string | null;
  attachments: StructureAttachment[];
}

/** Miroir de RegistrationStructureDetail::MAX_ATTACHMENTS. */
export const STRUCTURE_MAX_ATTACHMENTS = 10;

/** Miroir de RegistrationStructureAttachment::MAX_SIZE_BYTES. */
export const STRUCTURE_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Miroir de RegistrationStructureAttachment::ALLOWED_MIME_TYPES. */
export const STRUCTURE_ACCEPTED_MIME_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';

/** Miroir de RegistrationPartitionAttachment::MAX_PER_REGISTRATION (mêmes formats et taille que le barnum). */
export const PARTITION_MAX_ATTACHMENTS = 10;

/**
 * Du stand au total de la commande, frais compris : ce que l'exposant paiera réellement. Même
 * formule que Registration::getOrderTotalTtc() côté serveur (remise sur le stand seul, puis frais
 * et prestations supplémentaires).
 */
export interface OrderSummary {
  standTtc: number;
  /** Montant du stand fixé (devis signé) : il peut différer de la somme des lignes affichées. */
  standFixed: boolean;
  discountPercent: number;
  /** Montant retiré par la remise (positif). */
  discountTtc: number;
  fees: { label: string; amountTtc: number }[];
  extrasTtc: number;
  orderTotalTtc: number;
  depositRatePercent: number;
  depositTtc: number;
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
  /** `null` tant que l'exposant n'a rien saisi pour le barnum, ou s'il ne l'a pas coché. */
  structure: StructureDetailForm | null;
  /**
   * Plans / photos des cloisons, facultatifs. Rattachés à l'inscription côté serveur : ils
   * survivent à un changement de type de cloison, pas au retrait des cloisons.
   */
  partitionAttachments: StructureAttachment[];
  lines: StandLine[];
  totalTtc: number;
  totalVat: number;
  depositTtc: number;
  /** Commentaire libre de l'exposant sur sa demande (`null` si vide). */
  comment: string | null;
}

/** Longueur maximale du commentaire, miroir de Registration::EXHIBITOR_COMMENT_MAX_LENGTH. */
export const STAND_COMMENT_MAX_LENGTH = 2000;

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
  /** Vrai : standTotalTtc est fixé par le serveur. Faux : ce n'est que le total des options au chargement. */
  standTotalFixed: boolean;
  discountPercent: number;
  fileFeeTtc: number;
  /** Frais complémentaire de l'édition, ajouté aux frais de dossier ; 0 s'il n'y en a pas. */
  additionalFeeLabel: string;
  additionalFeeTtc: number;
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
  standName: string | null;
  activityDomainIds: string[];
  clubType: ClubType | null;
  entityManager: EntityManagerForm;
  previousEditions: string[] | null;
}

export interface StandStepPayload {
  /** `null` pour les groupes à quantité dérivée : le serveur la recalcule de toute façon. */
  selections: Record<string, number | null>;
  partition: PartitionDetailForm | null;
  structure: { characteristics: string | null } | null;
  comment: string | null;
}

export interface NewManagerPayload {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
}
