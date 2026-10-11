import { Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { FileUploadModule } from 'primeng/fileupload';
import { InputMaskDirective } from 'primeng/inputmask';
import { ClubType, EntityManagerForm, ExhibitorType, StandManagerForm } from '@app/dashboard/models/edition-form.models';
import { ValidatableFormStep } from '@app/dashboard/models/validatable-form-step';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { ActivityDomainService } from '@app/dashboard/services/activity-domain.service';
import { ActivityDomainApiDto } from '@app/dashboard/models/registration-api.models';
import { InsuranceRcComponent } from '@app/dashboard/page/edition-form/components/insurance-rc/insurance-rc.component';

interface ClubTypeOption {
  label: string;
  value: ClubType;
}

/**
 * Formulaire typé de l'étape Entité. `siret`/`clubType` sont nullable (et `activityDomainIds` peut
 * être vide) car leur validator (`required`) n'est appliqué que conditionnellement selon
 * `exhibitorType` — cf. `applyExhibitorTypeValidators()`.
 */
interface EntityFormControls {
  exhibitorType: ExhibitorType;
  companyName: string;
  siret: string | null;
  activityDomainIds: string[];
  clubType: ClubType | null;
  entityManager: EntityManagerForm;
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
    MultiSelectModule,
    FileUploadModule,
    InputMaskDirective,
    InsuranceRcComponent,
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
    activityDomainIds: this.fb.nonNullable.control<string[]>([]),
    clubType: this.fb.control<ClubType | null>(null),
    /** Responsable de l'entité : exigé quel que soit le type d'exposant, contrairement aux champs ci-dessus. */
    entityManager: this.fb.nonNullable.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      phone: [''],
      // `pattern` en plus de `email` : ce dernier accepte « a@b », que le back refuse à la soumission.
      email: ['', [Validators.required, Validators.email, Validators.pattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)]],
    }),
  });

  protected newManager: Omit<StandManagerForm, 'id'> = {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  };

  constructor() {
    /** Même raison que StepStandComponent : `ngOnInit` seul ne recapte pas un passage à readOnly après coup. */
    effect(() => {
      if (this.formState.isReadOnly()) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    const entity = this.formState.registration()?.entity;
    if (entity) {
      this.form.patchValue(entity, { emitEvent: false });
    }
    this.applyExhibitorTypeValidators(entity?.exhibitorType ?? ExhibitorType.PRO);

    this.form.controls.exhibitorType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.applyExhibitorTypeValidators(type));

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.formState.updateEntity(value as Partial<EntityFormControls>);
    });
  }

  /**
   * `siret`/`activityDomainIds` ne sont requis que pour un exposant PRO, `clubType` que pour un
   * CLUB. On efface aussi la valeur du champ qui devient non pertinent pour ne pas garder de
   * donnée fantôme envoyée au back (ex: SIRET conservé après bascule PRO → CLUB).
   */
  private applyExhibitorTypeValidators(type: ExhibitorType): void {
    const { siret, activityDomainIds, clubType } = this.form.controls;

    if (type === ExhibitorType.PRO) {
      siret.setValidators(Validators.required);
      activityDomainIds.setValidators(Validators.required);
      clubType.clearValidators();
      clubType.setValue(null, { emitEvent: false });
    } else {
      siret.clearValidators();
      activityDomainIds.clearValidators();
      siret.setValue(null, { emitEvent: false });
      activityDomainIds.setValue([], { emitEvent: false });
      clubType.setValidators(Validators.required);
    }

    siret.updateValueAndValidity({ emitEvent: false });
    activityDomainIds.updateValueAndValidity({ emitEvent: false });
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
