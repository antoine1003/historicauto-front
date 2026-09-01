/**
 * Reflète App\DTO\Registration\DocumentSummaryDto côté API.
 */
export type DocumentType = 'quote' | 'invoice' | 'ticket' | 'other' | 'insurance';
export type SignatureStatus = 'pending' | 'signed' | 'declined';

export interface DocumentSummary {
  id: string;
  type: DocumentType;
  label: string;
  fileUrl: string | null;
  signingUrl: string | null;
  signatureStatus: SignatureStatus;
  declineReason: string | null;
  amountTtc: string | null;
  depositPercent: string | null;
  notifiedAt: string | null;
  /** Date du dernier dépôt du fichier (updatedAt côté back) — toujours présente. */
  uploadedAt: string;
}

/**
 * Reflète App\DTO\Registration\SharedDocumentSummaryDto côté API — document commun à tous les
 * exposants d'une édition (liste fournisseurs, etc.), pas une DocumentItem propre à une Registration.
 */
export interface SharedDocumentItem {
  id: string;
  label: string;
  fileUrl: string | null;
  originalName: string | null;
  mimeType: string | null;
}
