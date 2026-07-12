import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { AccordionModule } from 'primeng/accordion';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputNumberModule } from 'primeng/inputnumber';
import { getOptionsByCategory } from '@app/dashboard/services/options-catalog';
import { ValidatableFormStep } from '@app/dashboard/models/validatable-form-step';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { OPTION_CATEGORY_LABELS, OptionCategory } from '@app/dashboard/models/edition-form.models';

@Component({
  selector: 'app-step-stand',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DecimalPipe,
    ButtonModule,
    AccordionModule,
    RadioButtonModule,
    InputNumberModule,
  ],
  templateUrl: './step-stand.component.html',
})
export class StepStandComponent implements OnInit, ValidatableFormStep {
  protected readonly formState = inject(EditionFormStateService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly surfaceOptions = getOptionsByCategory(OptionCategory.SURFACE);

  /** Catégories autres que la surface, affichées en accordéon avec quantité libre. */
  protected readonly addonCategories = Object.values(OptionCategory).filter(
    (category) => category !== OptionCategory.SURFACE,
  );

  /**
   * Seul `selectedSurfaceOptionId` porte une contrainte de validation : sans surface choisie
   * il n'y a pas de stand, donc pas de commande possible. Les quantités d'options
   * complémentaires restent gérées hors FormGroup (cf. `quantityFor`/`setQuantity`) puisqu'elles
   * n'ont pas de règle de validité — inutile d'alourdir le formulaire pour ça.
   */
  protected readonly form = this.fb.group({
    selectedSurfaceOptionId: this.fb.control<string | null>(null, Validators.required),
  });

  /** Affiché après un envoi réussi, tant que l'utilisateur reste sur cette étape. */
  protected readonly submitted = signal(false);

  ngOnInit(): void {
    const stand = this.formState.registration()?.stand;
    if (stand) {
      this.form.patchValue({ selectedSurfaceOptionId: stand.selectedSurfaceOptionId }, { emitEvent: false });
    }

    if (this.formState.isReadOnly()) {
      this.form.disable({ emitEvent: false });
    }

    this.form.controls.selectedSurfaceOptionId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((optionId) => this.formState.selectSurfaceOption(optionId));
  }

  protected categoryLabel(category: OptionCategory): string {
    return OPTION_CATEGORY_LABELS[category];
  }

  protected optionsForCategory(category: OptionCategory) {
    return getOptionsByCategory(category);
  }

  protected quantityFor(optionId: string): number {
    return this.formState.registration()?.stand.quantitiesByOptionId[optionId] ?? 0;
  }

  /**
   * Appelé par `EditionFormPageComponent` (via `@ViewChild`) au clic sur "Suivant". Révèle les
   * erreurs de validation à l'utilisateur et retourne la validité, pour bloquer la navigation
   * sans dupliquer les règles du FormGroup dans le service central.
   */
  validateAndTouch(): boolean {
    this.form.markAllAsTouched();
    return this.form.valid;
  }

  /**
   * Envoi de la demande de stand une fois le formulaire valide. Cf. TODO d'intégration sur
   * `EditionFormStateService.submitRegistrationOptions()` pour la cible API réelle
   * (POST /api/registrations/{id}/submit, transition DRAFT → SUBMITTED).
   */
  protected submit(): void {
    if (!this.validateAndTouch()) {
      return;
    }
    this.submitted.set(this.formState.submitRegistrationOptions());
  }

  /**
   * TODO : remplace l'appel `nous contacter` générique par une navigation vers le même
   * formulaire de contact que le bouton "Nous contacter", avec objet pré-rempli
   * "Formulaire espace exposant — commande complémentaire" (cf. cahier des charges étape 2).
   */
  protected requestAdditionalOrder(): void {
    // no-op (front only)
  }
}
