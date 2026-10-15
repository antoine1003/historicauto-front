/**
 * Formes JSON exactes renvoyées par l'API Symfony (historicauto-back, branche
 * worktree-registration-form-backend-api). Copié depuis les DTO PHP
 * (src/DTO/Registration/*.php) — ne pas modifier sans vérifier le DTO correspondant côté back.
 */

export interface StandManagerApiDto {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
}

export interface EntityManagerApiDto {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
}

export interface EntityStepApiDto {
  exhibitorType: string;
  companyName: string;
  siret: string | null;
  activityDomainIds: string[];
  clubType: string | null;
  visualUrl: string | null;
  entityManager: EntityManagerApiDto;
  previousEditions: string[] | null;
  managers: StandManagerApiDto[];
}

export interface PartitionDetailApiDto {
  layout: string;
  segments: number[];
  usageNotes: string | null;
}

export interface StructureAttachmentApiDto {
  id: string;
  originalName: string;
  mimeType: string | null;
  fileSize: number;
  url: string | null;
  createdAt: string;
}

export interface StructureDetailApiDto {
  characteristics: string | null;
  attachments: StructureAttachmentApiDto[];
}

export interface StandLineApiDto {
  optionId: string;
  groupCode: string;
  groupLabel: string;
  label: string;
  unit: string | null;
  quantity: number;
  unitPriceTtc: number;
  lineTotalTtc: number;
  vatRate: number;
  partition: PartitionDetailApiDto | null;
  structure: StructureDetailApiDto | null;
}

export interface StandStepApiDto {
  selections: Record<string, number>;
  partition: PartitionDetailApiDto | null;
  structure: StructureDetailApiDto | null;
  lines: StandLineApiDto[];
  totalTtc: number;
  totalVat: number;
  depositTtc: number;
  comment: string | null;
}

export interface ConfirmationStepApiDto {
  checklist: {
    acknowledgedQuoteAndPricing: boolean;
    acceptedGeneralTerms: boolean;
    noSublease: boolean;
    noStandSharing: boolean;
    cleanupCommitment: boolean;
    respectLayout: boolean;
    readAndApproved: boolean;
  };
  signatoryName: string;
  signatoryRole: string;
  confirmedAt: string | null;
}

/** Corps envoyé à POST /api/registrations/{id}/confirm — mêmes clés que ConfirmationStepApiDto. */
export interface ConfirmationPayload {
  checklist: {
    acknowledgedQuoteAndPricing: boolean;
    acceptedGeneralTerms: boolean;
    noSublease: boolean;
    noStandSharing: boolean;
    cleanupCommitment: boolean;
    respectLayout: boolean;
    readAndApproved: boolean;
  };
  signatoryName: string;
  signatoryRole: string;
}

export interface PaymentEntryApiDto {
  id: string;
  amountTtc: number;
  method: string;
  paidAt: string;
  label: string | null;
}

export interface ExtraOptionApiDto {
  id: string;
  label: string;
  quantity: number;
  unitPriceTtc: number;
  lineTotalTtc: number;
}

export interface PaymentStepApiDto {
  standTotalTtc: number;
  discountPercent: number;
  fileFeeTtc: number;
  depositRatePercent: number;
  /** Optionnel tant que la branche back de ce chantier n'est pas fusionnée : la clé peut être absente. */
  extraOptions?: ExtraOptionApiDto[];
  balanceDueDate: string | null;
  bankIban: string | null;
  bankBic: string | null;
  nextCardPaymentAmountTtc: number;
  payments: PaymentEntryApiDto[];
}

/** Réponse de POST /api/registrations/{id}/payment/checkout-session. */
export interface CheckoutSessionApiDto {
  url: string;
}

export interface RegistrationDetailApiDto {
  id: string;
  editionYear: string;
  status: string;
  readOnly: boolean;
  editionClosed: boolean;
  entity: EntityStepApiDto;
  stand: StandStepApiDto;
  confirmation: ConfirmationStepApiDto;
  documents: unknown[];
  payment: PaymentStepApiDto;
}

export interface OptionPriceApiDto {
  optionId: string;
  label: string;
  unit: string | null;
  surfaceSqm: number | null;
  includedBadges: number | null;
  priceTtc: number;
  vatRate: number;
  sortOrder: number;
}

export interface OptionGroupApiDto {
  code: string;
  label: string;
  helpText: string | null;
  inputType: string;
  isRequired: boolean;
  quantitySource: string;
  behaviour: string;
  sortOrder: number;
  collapsedByDefault: boolean;
  options: OptionPriceApiDto[];
}

export interface ActivityDomainApiDto {
  id: string;
  label: string;
}
