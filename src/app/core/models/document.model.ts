/**
 * Reflète App\DTO\Registration\DocumentSummaryDto côté API.
 */
export type DocumentType = 'quote' | 'invoice' | 'ticket' | 'other';

export interface DocumentSummary {
  id: string;
  type: DocumentType;
  label: string;
  fileUrl: string | null;
  signingUrl: string | null;
  isSigned: boolean;
  amountTtc: string | null;
  depositPercent: string | null;
  notifiedAt: string | null;
}
