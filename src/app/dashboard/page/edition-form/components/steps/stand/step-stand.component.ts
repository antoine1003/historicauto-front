import { Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { AccordionModule } from 'primeng/accordion';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { ValidatableFormStep } from '@app/dashboard/models/validatable-form-step';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { OptionsRecapComponent } from '@app/dashboard/components/options-recap/options-recap.component';
import {
  OptionGroupBehaviour,
  OptionGroupDefinition,
  OptionInputType,
  PARTITION_LAYOUT_LABELS,
  PARTITION_SEGMENT_COUNTS,
  PartitionDetailForm,
  PartitionLayout,
} from '@app/dashboard/models/edition-form.models';

@Component({
  selector: 'app-step-stand',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    ButtonModule,
    AccordionModule,
    RadioButtonModule,
    CheckboxModule,
    InputNumberModule,
    TextareaModule,
    OptionsRecapComponent,
  ],
  templateUrl: './step-stand.component.html',
})
export class StepStandComponent implements ValidatableFormStep {
  protected readonly formState = inject(EditionFormStateService);

  /** Exposés au gabarit pour comparer les valeurs d'enum sans les dupliquer en chaînes. */
  protected readonly OptionInputType = OptionInputType;
  protected readonly OptionGroupBehaviour = OptionGroupBehaviour;
  protected readonly partitionLayouts = Object.values(PartitionLayout);
  protected readonly layoutLabels = PARTITION_LAYOUT_LABELS;

  /** Les erreurs ne s'affichent qu'après une tentative de navigation ou d'envoi. */
  private readonly validationRevealed = signal(false);
  protected readonly showErrors = this.validationRevealed.asReadonly();

  protected readonly surfaceGroup = computed<OptionGroupDefinition | null>(
    () =>
      this.formState.optionGroups().find((group) => group.behaviour === OptionGroupBehaviour.SURFACE) ??
      null,
  );

  protected readonly addonGroups = computed<OptionGroupDefinition[]>(() =>
    this.formState.optionGroups().filter((group) => group.behaviour !== OptionGroupBehaviour.SURFACE),
  );

  /** Panneaux ouverts par défaut, pilotés par `collapsedByDefault` côté admin. */
  protected readonly expandedGroupCodes = computed<string[]>(() =>
    this.addonGroups()
      .filter((group) => !group.collapsedByDefault)
      .map((group) => group.code),
  );

  protected readonly partitionGroup = computed<OptionGroupDefinition | null>(
    () =>
      this.formState
        .optionGroups()
        .find((group) => group.behaviour === OptionGroupBehaviour.PARTITION) ?? null,
  );

  protected readonly partitionSelected = computed<boolean>(() => {
    const group = this.partitionGroup();

    return group !== null && group.options.some((option) => this.isSelected(option.id));
  });

  /** Miroir des règles serveur, pour signaler la saisie incomplète avant l'envoi. */
  protected readonly partitionErrors = computed<string[]>(() => {
    if (!this.partitionSelected()) {
      return [];
    }

    const detail = this.partition();
    if (detail === null) {
      return ['Choisissez une disposition de cloison.'];
    }

    const errors: string[] = [];
    const expected = PARTITION_SEGMENT_COUNTS[detail.layout];

    if (detail.segments.length !== expected) {
      errors.push(
        `La disposition « ${PARTITION_LAYOUT_LABELS[detail.layout]} » attend ${expected} longueur(s).`,
      );
    }
    if (detail.segments.some((length) => !(length > 0))) {
      errors.push('Indiquez une longueur strictement positive pour chaque cloison.');
    }

    return errors;
  });

  protected readonly isValid = computed<boolean>(
    () => this.formState.missingRequiredGroups().length === 0 && this.partitionErrors().length === 0,
  );

  constructor() {
    // Quel que soit l'inputType de la cloison (radio/checkbox/number), la désélection efface
    // toujours le détail, pour ne jamais patcher un détail orphelin.
    effect(() => {
      if (this.partitionGroup() !== null && !this.partitionSelected() && this.partition() !== null) {
        this.formState.setPartitionDetail(null);
      }
    });
  }

  protected selectedOptionIdFor(group: OptionGroupDefinition): string | null {
    return group.options.find((option) => this.isSelected(option.id))?.id ?? null;
  }

  protected isSelected(optionId: string): boolean {
    return (this.formState.registration()?.stand.selections[optionId] ?? 0) > 0;
  }

  protected quantityFor(optionId: string): number {
    return this.formState.registration()?.stand.selections[optionId] ?? 0;
  }

  protected partition(): PartitionDetailForm | null {
    return this.formState.registration()?.stand.partition ?? null;
  }

  protected segmentAt(index: number): number {
    return this.partition()?.segments[index] ?? 0;
  }

  protected segmentIndexes(): number[] {
    const detail = this.partition();
    if (detail === null) {
      return [];
    }

    return Array.from({ length: PARTITION_SEGMENT_COUNTS[detail.layout] }, (_, index) => index);
  }

  protected selectLayout(layout: PartitionLayout): void {
    const current = this.partition();
    const segments = Array.from(
      { length: PARTITION_SEGMENT_COUNTS[layout] },
      (_, index) => current?.segments[index] ?? 0,
    );

    this.formState.setPartitionDetail({ layout, segments, usageNotes: current?.usageNotes ?? null });
  }

  protected setSegment(index: number, value: number | null): void {
    const current = this.partition();
    if (current === null) {
      return;
    }

    const segments = [...current.segments];
    segments[index] = value ?? 0;
    this.formState.setPartitionDetail({ ...current, segments });
  }

  protected setUsageNotes(notes: string): void {
    const current = this.partition();
    if (current === null) {
      return;
    }

    this.formState.setPartitionDetail({ ...current, usageNotes: notes.trim() || null });
  }

  /**
   * Pose une disposition par défaut la première fois que les Cloisons sont sélectionnées, quel
   * que soit l'inputType (radio/checkbox/number) qui a déclenché la sélection, afin que les
   * champs de longueur apparaissent immédiatement. La désélection est gérée uniformément par
   * l'`effect()` du constructeur.
   */
  private ensurePartitionDefaultLayout(): void {
    if (this.partition() === null) {
      this.selectLayout(PartitionLayout.BACK);
    }
  }

  /**
   * Point d'entrée unique des cases à cocher, pour que le gabarit n'ait pas à choisir entre deux
   * méthodes selon la section.
   */
  protected onCheckboxChange(group: OptionGroupDefinition, optionId: string, selected: boolean): void {
    this.formState.toggleOption(optionId, selected);

    if (group.behaviour === OptionGroupBehaviour.PARTITION && selected) {
      this.ensurePartitionDefaultLayout();
    }
  }

  /**
   * Point d'entrée unique des groupes à choix unique (radio), pour que la pose de disposition
   * par défaut des Cloisons fonctionne aussi lorsque ce groupe est configuré en RADIO plutôt
   * qu'en CHECKBOX.
   */
  protected onRadioChange(group: OptionGroupDefinition, optionId: string | null): void {
    this.formState.selectSingleOption(group, optionId);

    if (group.behaviour === OptionGroupBehaviour.PARTITION && optionId !== null) {
      this.ensurePartitionDefaultLayout();
    }
  }

  /**
   * Point d'entrée unique des quantités numériques, pour que la pose de disposition par défaut
   * des Cloisons fonctionne aussi lorsque ce groupe est configuré en NUMBER.
   */
  protected onQuantityChange(group: OptionGroupDefinition, optionId: string, quantity: number): void {
    this.formState.setOptionQuantity(optionId, quantity);

    if (group.behaviour === OptionGroupBehaviour.PARTITION && quantity > 0) {
      this.ensurePartitionDefaultLayout();
    }
  }

  /**
   * Appelé par `EditionFormPageComponent` (via `@ViewChild`) au clic sur « Suivant ». Révèle les
   * erreurs à l'exposant et retourne la validité, pour bloquer la navigation sans dupliquer les
   * règles ailleurs.
   */
  validateAndTouch(): boolean {
    this.validationRevealed.set(true);

    return this.isValid();
  }

  protected submit(): void {
    if (!this.validateAndTouch()) {
      return;
    }
    this.formState.submitRegistrationOptions();
  }

  /**
   * TODO : remplace l'appel `nous contacter` générique par une navigation vers le même
   * formulaire de contact que le bouton « Nous contacter », avec objet pré-rempli
   * « Formulaire espace exposant — commande complémentaire » (cf. cahier des charges étape 2).
   */
  protected requestAdditionalOrder(): void {
    // no-op (front only)
  }
}
