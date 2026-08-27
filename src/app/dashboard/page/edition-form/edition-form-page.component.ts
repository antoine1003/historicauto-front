import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StepperModule } from 'primeng/stepper';
import { ButtonModule } from 'primeng/button';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';
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
import { AutosaveStatus, RegistrationStep } from '@app/dashboard/models/edition-form.models';
import { ValidatableFormStep } from '@app/dashboard/models/validatable-form-step';
import { LoaderComponent } from '@app/shared/components/loader/loader.component';
import { Title } from '@angular/platform-browser';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-edition-form-page',
  imports: [
    StepperModule,
    ButtonModule,
    BreadcrumbModule,
    RouterLink,
    StepEntityComponent,
    StepStandComponent,
    StepConfirmationComponent,
    StepDocumentsComponent,
    StepPaymentComponent,
    LoaderComponent,
  ],
  styleUrl: '../../../core/styles/edition-form.theme.css',
  styles: [
    `
      .ef-breadcrumb-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 0.75rem 1rem;
        max-width: 64rem;
        margin: 0 auto;
      }

      @media (min-width: 640px) {
        .ef-breadcrumb-bar {
          padding: 1rem 2rem;
        }
      }

      :host ::ng-deep .ef-breadcrumb-bar .p-breadcrumb {
        background: transparent;
        border: none;
        padding: 0;
      }
    `,
  ],
  templateUrl: './edition-form-page.component.html',
  standalone: true
})
export class EditionFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly router = inject(Router);
  protected readonly formState = inject(EditionFormStateService);

  @ViewChild(StepEntityComponent) private readonly entityStep?: StepEntityComponent;
  @ViewChild(StepStandComponent) private readonly standStep?: StepStandComponent;

  protected readonly RegistrationStep = RegistrationStep;
  protected missingYearParam = false;

  /** Centralisée dans `environment` pour ne pas dupliquer l'adresse en dur dans les templates. */
  protected readonly contactEmail = environment.contactEmail;

  /** Année lue une seule fois dans ngOnInit — reste affichable même si le chargement échoue. */
  protected readonly year = signal<string | null>(null);

  protected readonly breadcrumb = computed<MenuItem[]>(() => [
    { label: 'Mon Espace', routerLink: '/dashboard' },
    { label: `Inscription ${this.year() ?? ''}`.trim() },
  ]);

  ngOnInit(): void {
    const year = this.route.snapshot.paramMap.get('year');
    if (!year) {
      this.missingYearParam = true;
      return;
    }

    this.year.set(year);

    const paymentParam = this.route.snapshot.queryParamMap.get('payment');
    const paymentReturnStatus = paymentParam === 'success' || paymentParam === 'cancelled' ? paymentParam : null;
    this.formState.loadForEditionYear(year, paymentReturnStatus);

    if (paymentReturnStatus) {
      // Retire `?payment=...` de l'URL une fois consommé : un rafraîchissement ou un
      // marque-page ne doit pas refaire apparaître le toast des jours plus tard.
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }

    this.title.setTitle(`Formulaire d'inscription ${year}`);
  }

  protected onStepChange(value: number | undefined): void {
    if (value === undefined) {
      return;
    }
    this.formState.goToStep(value as RegistrationStep);
  }

  /** Statut d'autosave à afficher dans l'en-tête : celui de l'étape actuellement affichée. */
  protected currentAutosaveStatus(): AutosaveStatus {
    switch (this.formState.activeStep()) {
      case RegistrationStep.ENTITY:
        return this.formState.entityAutosaveStatus();
      case RegistrationStep.STAND:
        return this.formState.standAutosaveStatus();
      default:
        return 'idle';
    }
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
    if (!this.formState.isReadOnly() && currentStep && !currentStep.validateAndTouch()) {
      return;
    }
    this.formState.goToNextStep();
  }
}
