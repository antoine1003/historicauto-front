import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { MessageModule } from 'primeng/message';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { OptionsRecapComponent } from '@app/dashboard/components/options-recap/options-recap.component';
import { RegistrationStatus } from '@app/dashboard/models/edition-form.models';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Carte bancaire',
  transfer: 'Virement',
  cheque: 'Chèque',
  cash: 'Espèces',
};

/**
 * Tolérance sur les comparaisons de montants. Les totaux sont recalculés en flottant à partir de
 * pourcentages ; sans elle, un acompte exactement payé peut se lire comme 0,000000001 € manquant.
 */
const EPSILON = 0.005;

@Component({
  selector: 'app-step-payment',
  standalone: true,
  imports: [DatePipe, DecimalPipe, ButtonModule, TableModule, MessageModule, OptionsRecapComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
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
    // Montant du stand de orderSummary : fixé par le serveur s'il l'est, sinon total des options à jour.
    return (this.formState.orderSummary()?.standTtc ?? 0) * (1 - reg.payment.discountPercent / 100);
  });

  protected readonly extraOptionsTotalTtc = computed(() => {
    const reg = this.formState.registration();
    return reg
      ? reg.payment.extraOptions.reduce((sum, extra) => sum + extra.lineTotalTtc, 0)
      : 0;
  });

  protected readonly orderTotalTtc = computed(() => {
    const reg = this.formState.registration();
    // Même formule que Registration::getOrderTotalTtc() et que balanceDueTtc() du service : les
    // prestations s'ajoutent après la remise. Les trois doivent rester d'accord.
    return reg
      ? this.discountedTotalTtc() + reg.payment.fileFeeTtc + reg.payment.additionalFeeTtc + this.extraOptionsTotalTtc()
      : 0;
  });

  protected readonly depositDueTtc = computed(() => {
    const reg = this.formState.registration();
    return reg ? this.orderTotalTtc() * (reg.payment.depositRatePercent / 100) : 0;
  });

  /**
   * Deux signaux indépendants sont acceptés. Le précédent est la branche CONFIRMATION de
   * `EditionFormStateService.isStepUnlocked()`, qui traite déjà `confirmation.confirmedAt`
   * comme un signal de confirmation à part entière, indépendant de `status`. La raison est la
   * même ici : `status` est synchronisé de façon asynchrone depuis le serveur et peut accuser un
   * retard sur la signature, reçue par son propre webhook — la branche PAYMENT du même
   * `isStepUnlocked()` compose d'ailleurs avec ce décalage, en acceptant un devis signé à la
   * place du statut. Un exposant peut donc légitimement se trouver sur cette étape, devis signé,
   * alors que `status` n'est pas encore passé à CONFIRMED. Cet écran ne doit jamais annoncer à un
   * exposant confirmé que son inscription n'est pas définitive.
   */
  protected readonly isRegistrationConfirmed = computed(() => {
    const reg = this.formState.registration();
    const status = reg?.status;
    return (
      status === RegistrationStatus.CONFIRMED ||
      status === RegistrationStatus.COMPLETED ||
      reg?.confirmation.confirmedAt != null
    );
  });

  /**
   * L'ordre des tests compte. `settled` est évalué avant `deposit` pour qu'un solde nul l'emporte,
   * et le retour anticipé sur un total payé nul écarte le cas dégénéré d'une commande à 0 €, qui
   * serait sinon annoncée « intégralement réglée » avant tout paiement.
   */
  protected readonly paymentState = computed<'unpaid' | 'partial' | 'deposit' | 'settled'>(() => {
    const paid = this.formState.paymentsTotalTtc();

    if (paid <= EPSILON) {
      return 'unpaid';
    }

    if (this.formState.balanceDueTtc() <= EPSILON) {
      return 'settled';
    }

    return paid + EPSILON >= this.depositDueTtc() ? 'deposit' : 'partial';
  });

  protected methodLabel(method: string): string {
    return PAYMENT_METHOD_LABELS[method] ?? method;
  }

  protected payByCard(): void {
    this.formState.startCardPayment();
  }
}
