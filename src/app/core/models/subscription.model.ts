// ─── Plans ────────────────────────────────────────────────

export interface Plan {
  id: 'monthly' | 'quarterly';
  label: string;
  price: string;          // "9,99 €"
  priceInCents: number;
  durationDays: number;
}

export interface PaymentTypeOption {
  id: 'one_time' | 'recurring';
  label: string;
}

export interface PlansResponse {
  plans: Plan[];
  paymentTypes: PaymentTypeOption[];
}

// ─── Checkout ─────────────────────────────────────────────

export interface CheckoutRequest {
  plan: 'monthly' | 'quarterly';
  paymentType: 'one_time' | 'recurring';
}

export interface CheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
}

// ─── Subscription ─────────────────────────────────────────

export interface SubscriptionDetail {
  id: number;
  plan: 'monthly' | 'quarterly';
  planLabel: string;
  status: 'active' | 'canceled' | 'expired' | 'past_due' | 'incomplete';
  paymentType: 'one_time' | 'recurring';
  amount: string;         // "9,99 €"
  startDate: string | null;
  endDate: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  remainingDays: number;
  cancelAtPeriodEnd: boolean;
  isActive: boolean;
}

export interface SubscriptionResponse {
  subscription: SubscriptionDetail | null;
  isPremium: boolean;
}

// ─── History ──────────────────────────────────────────────

export interface SubscriptionHistoryResponse {
  subscriptions: SubscriptionDetail[];
}

// ─── Cancel / Reactivate ─────────────────────────────────

export interface CancelRequest {
  immediately?: boolean;
}

export interface SubscriptionActionResponse {
  message: string;
  subscription: SubscriptionDetail;
}

// ─── Error ────────────────────────────────────────────────

export interface ApiError {
  error: string;
}
