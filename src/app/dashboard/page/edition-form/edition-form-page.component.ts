import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StepperModule } from 'primeng/stepper';
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

@Component({
  selector: 'app-edition-form-page',
  imports: [
    StepperModule,
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
}
