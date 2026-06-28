export interface Edition {
  id: string;
  year: string;
  salonStartDate: string | null;
  salonEndDate: string | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  paymentDeadline: string | null;
  isActive: boolean;
  registrationOpen: boolean;
  isVisible: boolean;
}
