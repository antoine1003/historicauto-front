import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StepperModule } from 'primeng/stepper';
import { ButtonModule } from 'primeng/button';
import {
  StepConfirmationComponent
} from '@app/dashboard/page/edition-form/components/steps/confirmation/step-confirmation.component';
import { StepStandComponent } from '@app/dashboard/page/edition-form/components/steps/stand/step-stand.component';
import { StepEntityComponent } from '@app/dashboard/page/edition-form/components/steps/entity/step-entity.component';
import {
  StepDocumentsComponent
} from '@app/dashboard/page/edition-form/components/steps/documents/step-documents.component';
import { StepPaymentComponent } from '@app/dashboard/page/edition-form/components/steps/payment/step-payment.component';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { RegistrationStep } from '@app/dashboard/models/edition-form.models';
import { ValidatableFormStep } from '@app/dashboard/models/validatable-form-step';

@Component({
  selector: 'app-edition-form-page',
  imports: [
    StepperModule,
    ButtonModule,
    StepEntityComponent,
    StepStandComponent,
    StepConfirmationComponent,
    StepDocumentsComponent,
    StepPaymentComponent,
  ],
  styleUrl: '../../../core/styles/edition-form.theme.css',
  templateUrl: './edition-form-page.component.html',
  standalone: true
})
export class EditionFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly formState = inject(EditionFormStateService);

  @ViewChild(StepEntityComponent) private readonly entityStep?: StepEntityComponent;
  @ViewChild(StepStandComponent) private readonly standStep?: StepStandComponent;

  protected readonly RegistrationStep = RegistrationStep;
  protected notFound = false;

  ngOnInit(): void {
    const year = this.route.snapshot.paramMap.get('year');
    if (!year || !this.formState.loadForEditionYear(year)) {
      this.notFound = true;
    }
  }

  protected onStepChange(value: number | undefined): void {
    if (value === undefined) {
      return;
    }
    this.formState.goToStep(value as RegistrationStep);
  }

  /**
   * Le composant de l'étape courante (s'il porte une validation bloquante) n'est monté que
   * lorsqu'elle est active dans le `p-stepper` — seule une des deux `@ViewChild` est donc
   * définie à un instant donné. Les étapes Confirmation/Documents/Paiement n'ont pas de garde
   * de progression ici, elles gèrent leurs propres règles (checklist, statut backend).
   */
  private currentValidatableStep(): ValidatableFormStep | undefined {
    switch (this.formState.activeStep()) {
      case RegistrationStep.ENTITY:
        return this.entityStep;
      case RegistrationStep.STAND:
        return this.standStep;
      default:
        return undefined;
    }
  }

  protected goToNextStep(): void {
    const currentStep = this.currentValidatableStep();
    if (currentStep && !currentStep.validateAndTouch()) {
      return;
    }
    this.formState.goToNextStep();
  }
}
