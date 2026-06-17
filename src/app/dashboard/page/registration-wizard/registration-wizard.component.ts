// src/app/features/mon-espace/pages/registration-wizard/registration-wizard.component.ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { StepperModule } from 'primeng/stepper';
import { ButtonModule } from 'primeng/button';
import { RegistrationStatus } from '@app/core/models/registration.model';

interface WizardStep {
  id: number;
  label: string;
}

@Component({
  selector: 'app-registration-wizard',
  standalone: true,
  imports: [StepperModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-shell !min-h-0 !p-0 items-start justify-start">
      <div class="w-full max-w-4xl mx-auto px-4 py-8 sm:py-10">

        <h1 class="font-serif font-semibold text-2xl sm:text-[2.2rem] text-[#1A1714] mb-6">
          Formulaire d'inscription
        </h1>

        <p-stepper [value]="activeStep()" class="block">
          @for (step of steps; track step.id) {
            <p-step-item [value]="step.id">
              <p-step
                [disabled]="isLocked(step.id)"
                (click)="onStepClick(step.id)"
              >
                {{ step.label }}
              </p-step>

              <p-step-panel>
                <ng-template #content>
                  <div class="auth-card !max-w-none my-4">
                    <!-- Contenu de l'étape {{ step.id }} : à implémenter -->
                    <p class="text-[#6B6560]">
                      Étape « {{ step.label }} » — contenu à venir.
                    </p>
                  </div>

                  <div class="flex flex-col sm:flex-row gap-3 sm:justify-between">
                    @if (step.id > 1) {
                      <p-button
                        label="Revenir"
                        severity="secondary"
                        styleClass="w-full sm:w-auto"
                        (onClick)="goTo(step.id - 1)"
                      />
                    }
                    @if (step.id < steps.length && !isLocked(step.id + 1)) {
                      <p-button
                        label="Valider pour passer à l'étape suivante"
                        styleClass="auth-btn-primary !w-full sm:!w-auto sm:ml-auto"
                        (onClick)="goTo(step.id + 1)"
                      />
                    }
                  </div>
                </ng-template>
              </p-step-panel>
            </p-step-item>
          }
        </p-stepper>

      </div>
    </div>
  `,
})
export class RegistrationWizardComponent {
  readonly steps: WizardStep[] = [
    { id: 1, label: 'Entité' },
    { id: 2, label: 'Stand' },
    { id: 3, label: 'Confirmation' },
    { id: 4, label: 'Documents' },
    { id: 5, label: 'Paiement' },
  ];

  // TODO: alimenter depuis la Registration récupérée via la route (resolver/input).
  private readonly status = signal<RegistrationStatus>('draft');

  readonly activeStep = signal(1);

  /**
   * Étape 4 (Documents) déverrouillée seulement à partir de "accepted"
   * (cf. STEP 4 : mail envoyé après acceptation → accès aux documents).
   * Étape 5 (Paiement) déverrouillée seulement une fois le devis signé,
   * donc à partir de "confirmed".
   */
  isLocked(stepId: number): boolean {
    const s = this.status();
    if (stepId === 4) {
      return !['accepted', 'confirmed', 'completed'].includes(s);
    }
    if (stepId === 5) {
      return !['confirmed', 'completed'].includes(s);
    }
    return false;
  }

  goTo(stepId: number): void {
    if (!this.isLocked(stepId)) {
      this.activeStep.set(stepId);
    }
  }

  onStepClick(stepId: number): void {
    this.goTo(stepId);
  }
}
