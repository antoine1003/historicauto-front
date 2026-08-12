/**
 * Reflète App\DTO\Registration\DocumentSummaryDto côté API.
 */
export type DocumentType = 'quote' | 'invoice' | 'ticket' | 'other';
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
}
