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

export interface EntityStepApiDto {
  exhibitorType: string;
  companyName: string;
  siret: string | null;
  activityDomainId: string | null;
  clubType: string | null;
  visualUrl: string | null;
  managers: StandManagerApiDto[];
}

export interface StandStepApiDto {
  selectedSurfaceOptionId: string | null;
  quantitiesByOptionId: Record<string, number>;
  standTotalTtc: number;
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

export interface PaymentStepApiDto {
  standTotalTtc: number;
  discountPercent: number;
  fileFeeTtc: number;
  depositRatePercent: number;
  balanceDueDate: string | null;
  payments: unknown[];
}

export interface RegistrationDetailApiDto {
  id: string;
  editionYear: string;
  status: string;
  readOnly: boolean;
  entity: EntityStepApiDto;
  stand: StandStepApiDto;
  confirmation: ConfirmationStepApiDto;
  documents: unknown[];
  payment: PaymentStepApiDto;
}

export interface OptionPriceApiDto {
  optionId: string;
  category: string;
  label: string;
  unit: string | null;
  includedBadges: number | null;
  exhibitorType: string | null;
  priceTtc: number;
  vatRate: number;
}

export interface ActivityDomainApiDto {
  id: string;
  label: string;
}
