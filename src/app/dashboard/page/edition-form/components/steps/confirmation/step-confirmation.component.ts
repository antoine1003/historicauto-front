import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { ConfirmationChecklistState } from '@app/dashboard/models/edition-form.models';

interface ChecklistItem {
  key: keyof ConfirmationChecklistState;
  text: string;
}

@Component({
  selector: 'app-step-confirmation',
  standalone: true,
  imports: [FormsModule, DatePipe, ButtonModule, CheckboxModule, InputTextModule, MessageModule],
  templateUrl: './step-confirmation.component.html',
})
export class StepConfirmationComponent {
  protected readonly formState = inject(EditionFormStateService);
  protected readonly today = new Date();

  protected readonly checklistItems: ChecklistItem[] = [
    { key: 'acknowledgedQuoteAndPricing', text: "J'ai pris connaissance de mon devis, de toutes les options commandées et des tarifs associés et modalités de paiement." },
    { key: 'acceptedGeneralTerms', text: "Je déclare avoir pris connaissance des conditions générales de vente et de participation et j'en accepte sans réserve toutes les clauses." },
    { key: 'noSublease', text: "J'interdis de céder, même à titre gracieux, ou sous-louer, de quelque manière que ce soit, mon emplacement." },
    { key: 'noStandSharing', text: "Je m'engage à ne pas mutualiser mon stand avec une autre entité et à ne pas promouvoir un tiers sans autorisation écrite." },
    { key: 'cleanupCommitment', text: "Je m'engage à laisser l'espace loué dans son état initial, libre de tout détritus." },
    { key: 'respectLayout', text: "Je m'engage à respecter les alignements et l'emplacement qui me seront attribués." },
    { key: 'readAndApproved', text: 'Lu et approuvé.' },
  ];

  protected readonly allChecked = computed(() => {
    const checklist = this.formState.registration()?.confirmation.checklist;
    return checklist ? Object.values(checklist).every(Boolean) : false;
  });

  protected readonly canConfirm = computed(() => {
    const confirmation = this.formState.registration()?.confirmation;
    return Boolean(confirmation) && this.allChecked() && !!confirmation!.signatoryName && !!confirmation!.signatoryRole;
  });

  protected toggleItem(key: keyof ConfirmationChecklistState, checked: boolean): void {
    this.formState.updateConfirmationChecklist({ [key]: checked });
  }

  protected updateSignatoryName(name: string): void {
    const role = this.formState.registration()?.confirmation.signatoryRole ?? '';
    this.formState.updateSignatory(name, role);
  }

  protected updateSignatoryRole(role: string): void {
    const name = this.formState.registration()?.confirmation.signatoryName ?? '';
    this.formState.updateSignatory(name, role);
  }

  protected confirm(): void {
    this.formState.confirmRegistration();
  }
}
