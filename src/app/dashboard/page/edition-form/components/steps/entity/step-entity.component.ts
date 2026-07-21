import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { FileUploadModule } from 'primeng/fileupload';
import { InputMaskDirective } from 'primeng/inputmask';
import { ClubType, ExhibitorType, StandManagerForm } from '@app/dashboard/models/edition-form.models';
import { ValidatableFormStep } from '@app/dashboard/models/validatable-form-step';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { ActivityDomainService } from '@app/dashboard/services/activity-domain.service';
import { ActivityDomainApiDto } from '@app/dashboard/models/registration-api.models';

interface ClubTypeOption {
  label: string;
  value: ClubType;
}

/**
 * Formulaire typé de l'étape Entité. `siret`/`activityDomainId`/`clubType` sont nullable au niveau
 * du type car leur validator (`required`) n'est appliqué que conditionnellement selon
 * `exhibitorType` — cf. `applyExhibitorTypeValidators()`.
 */
interface EntityFormControls {
  exhibitorType: ExhibitorType;
  companyName: string;
  siret: string | null;
  activityDomainId: string | null;
  clubType: ClubType | null;
}

@Component({
  selector: 'app-step-entity',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    FileUploadModule,
    InputMaskDirective,
  ],
  templateUrl: './step-entity.component.html',
})
export class StepEntityComponent implements OnInit, ValidatableFormStep {
  protected readonly formState = inject(EditionFormStateService);
  private readonly activityDomainService = inject(ActivityDomainService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly ExhibitorType = ExhibitorType;

  protected readonly clubTypeOptions: ClubTypeOption[] = [
    { label: 'Marque / Modèle', value: ClubType.BRAND_MODEL },
    { label: 'Généraliste', value: ClubType.GENERALIST },
  ];

  protected readonly activityDomainOptions = toSignal(this.activityDomainService.getAll(), {
    initialValue: [] as ActivityDomainApiDto[],
  });

  protected readonly form = this.fb.group({
    exhibitorType: this.fb.nonNullable.control<ExhibitorType>(ExhibitorType.PRO),
    companyName: this.fb.nonNullable.control('', Validators.required),
    siret: this.fb.control<string | null>(null),
    activityDomainId: this.fb.control<string | null>(null),
    clubType: this.fb.control<ClubType | null>(null),
  });

  protected newManager: Omit<StandManagerForm, 'id'> = {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  };

  ngOnInit(): void {
    const entity = this.formState.registration()?.entity;
    if (entity) {
      this.form.patchValue(entity, { emitEvent: false });
    }
    this.applyExhibitorTypeValidators(entity?.exhibitorType ?? ExhibitorType.PRO);

    if (this.formState.isReadOnly()) {
      this.form.disable({ emitEvent: false });
    }

    this.form.controls.exhibitorType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.applyExhibitorTypeValidators(type));

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.formState.updateEntity(value as Partial<EntityFormControls>);
    });
  }

  /**
   * `siret`/`activityDomainId` ne sont requis que pour un exposant PRO, `clubType` que pour un
   * CLUB. On efface aussi la valeur du champ qui devient non pertinent pour ne pas garder de
   * donnée fantôme envoyée au back (ex: SIRET conservé après bascule PRO → CLUB).
   */
  private applyExhibitorTypeValidators(type: ExhibitorType): void {
    const { siret, activityDomainId, clubType } = this.form.controls;

    if (type === ExhibitorType.PRO) {
      siret.setValidators(Validators.required);
      activityDomainId.setValidators(Validators.required);
      clubType.clearValidators();
      clubType.setValue(null, { emitEvent: false });
    } else {
      siret.clearValidators();
      activityDomainId.clearValidators();
      siret.setValue(null, { emitEvent: false });
      activityDomainId.setValue(null, { emitEvent: false });
      clubType.setValidators(Validators.required);
    }

    siret.updateValueAndValidity({ emitEvent: false });
    activityDomainId.updateValueAndValidity({ emitEvent: false });
    clubType.updateValueAndValidity({ emitEvent: false });
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

  protected addManager(): void {
    if (!this.newManager.firstName || !this.newManager.lastName || !this.newManager.email) {
      return;
    }

    this.formState.addManager(this.newManager);
    this.newManager = { firstName: '', lastName: '', phone: '', email: '' };
  }

  protected removeManager(managerId: string): void {
    this.formState.removeManager(managerId);
  }

  /**
   * Téléversement réel du visuel via POST /api/registrations/{id}/logo.
   */
  protected onVisualSelected(event: { files: File[] }): void {
    const file = event.files[0];
    if (file) {
      this.formState.uploadLogo(file);
    }
  }
}
