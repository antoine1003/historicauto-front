import { Component, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { MessageModule } from 'primeng/message';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Carte bancaire',
  transfer: 'Virement',
  cheque: 'Chèque',
  cash: 'Espèces',
};

@Component({
  selector: 'app-step-payment',
  standalone: true,
  imports: [DatePipe, DecimalPipe, ButtonModule, TableModule, MessageModule],
  templateUrl: './step-payment.component.html',
})
export class StepPaymentComponent {
  protected readonly formState = inject(EditionFormStateService);

  protected readonly hasDiscount = computed(() => (this.formState.registration()?.payment.discountPercent ?? 0) > 0);

  protected readonly discountedTotalTtc = computed(() => {
    const reg = this.formState.registration();
    if (!reg) {
      return 0;
    }
    return reg.payment.standTotalTtc * (1 - reg.payment.discountPercent / 100);
  });

  protected readonly orderTotalTtc = computed(() => {
    const reg = this.formState.registration();
    return reg ? this.discountedTotalTtc() + reg.payment.fileFeeTtc : 0;
  });

  protected readonly depositDueTtc = computed(() => {
    const reg = this.formState.registration();
    return reg ? this.orderTotalTtc() * (reg.payment.depositRatePercent / 100) : 0;
  });

  protected methodLabel(method: string): string {
    return PAYMENT_METHOD_LABELS[method] ?? method;
  }

  /**
   * TODO intégration : déclenche le plugin de paiement en ligne (Stripe/PayPal). Le solde
   * affiché ici doit rester piloté par le back (Payment ajoutés depuis le dashboard HA), le
   * front ne doit jamais recalculer un "payé" optimiste avant confirmation du paiement.
   */
  protected payByCard(): void {
    // no-op (front only)
  }
}
