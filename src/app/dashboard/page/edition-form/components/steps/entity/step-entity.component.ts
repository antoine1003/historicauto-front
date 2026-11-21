import { Component, computed, DestroyRef, effect, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { AutoCompleteCompleteEvent, AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { catchError, of, Subject, switchMap } from 'rxjs';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { CheckboxModule } from 'primeng/checkbox';
import { FileUploadModule } from 'primeng/fileupload';
import { InputMaskDirective } from 'primeng/inputmask';
import { ClubType, EntityManagerForm, ExhibitorType, StandManagerForm } from '@app/dashboard/models/edition-form.models';
import { ValidatableFormStep } from '@app/dashboard/models/validatable-form-step';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { ActivityDomainService } from '@app/dashboard/services/activity-domain.service';
import { PastEditionService } from '@app/dashboard/services/past-edition.service';
import { PreviousStandService } from '@app/dashboard/services/previous-stand.service';
import { normalizeStandName, PreviousStandDto } from '@app/dashboard/models/previous-stand.models';
import { PreviousStandReminderComponent } from '@app/dashboard/page/edition-form/components/previous-stand-reminder/previous-stand-reminder.component';
import { ActivityDomainApiDto } from '@app/dashboard/models/registration-api.models';
import { InsuranceRcComponent } from '@app/dashboard/page/edition-form/components/insurance-rc/insurance-rc.component';
import { isValidOrEmptyPhone, PhoneFormatDirective, PhonePipe, phoneValidator } from '@app/shared/phone/phone-format';

/**
 * « Vous étiez présent en » est obligatoire, mais `[]` (« Aucun ») est une réponse valide : seul
 * `null` (pas encore répondu) est refusé, ce que `Validators.required` ne sait pas exprimer.
 */
function answeredValidator(control: AbstractControl): ValidationErrors | null {
  return control.value === null ? { required: true } : null;
}

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
  standName: string | null;
  activityDomainIds: string[];
  clubType: ClubType | null;
  entityManager: EntityManagerForm;
  previousEditions: string[] | null;
}

@Component({
  selector: 'app-step-entity',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    AutoCompleteModule,
    PreviousStandReminderComponent,
    SelectModule,
    MultiSelectModule,
    CheckboxModule,
    FileUploadModule,
    InputMaskDirective,
    InsuranceRcComponent,
    PhoneFormatDirective,
    PhonePipe,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './step-entity.component.html',
})
export class StepEntityComponent implements OnInit, ValidatableFormStep {
  protected readonly formState = inject(EditionFormStateService);
  private readonly activityDomainService = inject(ActivityDomainService);
  private readonly pastEditionService = inject(PastEditionService);
  private readonly previousStandService = inject(PreviousStandService);
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

  private readonly pastEditionOptions = toSignal(this.pastEditionService.getAll(), { initialValue: [] as string[] });

  /**
   * Années à cocher : celles proposées par l'admin, plus celles déjà enregistrées sur l'inscription
   * mais désactivées depuis, pour que l'exposant voie toujours ce qu'il a coché.
   */
  protected readonly previousEditionYears = computed(() =>
    [...new Set([...this.pastEditionOptions(), ...(this.formState.registration()?.entity.previousEditions ?? [])])].sort(),
  );

  /** Suggestions du champ « nom » : stands de l'édition précédente dont le nom ressemble à la saisie. */
  protected readonly standSuggestions = signal<PreviousStandDto[]>([]);

  /** Stand de l'édition précédente reconnu pour le nom saisi, affiché en rappel sous le champ. */
  protected readonly previousStand = signal<PreviousStandDto | null>(null);

  private readonly standQuery$ = new Subject<string>();

  protected readonly form = this.fb.group({
    exhibitorType: this.fb.nonNullable.control<ExhibitorType>(ExhibitorType.PRO),
    companyName: this.fb.nonNullable.control('', Validators.required),
    siret: this.fb.control<string | null>(null),
    /** Facultatif, pros uniquement : nom affiché du stand s'il diffère de l'entité de facturation. */
    standName: this.fb.control<string | null>(null, Validators.maxLength(255)),
    activityDomainIds: this.fb.nonNullable.control<string[]>([]),
    clubType: this.fb.control<ClubType | null>(null),
    /** Responsable de l'entité : exigé quel que soit le type d'exposant, contrairement aux champs ci-dessus. */
    entityManager: this.fb.nonNullable.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      phone: ['', phoneValidator],
      // `pattern` en plus de `email` : ce dernier accepte « a@b », que le back refuse à la soumission.
      email: ['', [Validators.required, Validators.email, Validators.pattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)]],
    }),
    /** `null` = pas répondu, `[]` = « Aucun ». Piloté par les cases de la carte « Vous étiez présent en ». */
    previousEditions: this.fb.control<string[] | null>(null, answeredValidator),
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

    this.standQuery$
      .pipe(
        switchMap((q) => this.previousStandService.search(q).pipe(catchError(() => of([] as PreviousStandDto[])))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((stands) => this.standSuggestions.set(stands));

    // Le rappel ne vaut que pour le nom exact du stand reconnu : toute modification le retire.
    this.form.controls.companyName.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((name) => {
      const stand = this.previousStand();
      if (stand && normalizeStandName(name) !== normalizeStandName(stand.standName)) {
        this.previousStand.set(null);
      }
    });

    this.restorePreviousStand();

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.formState.updateEntity(value as Partial<EntityFormControls>);
    });
  }

  protected searchPreviousStands(event: AutoCompleteCompleteEvent): void {
    this.standQuery$.next(event.query);
  }

  /** Le contrôle porte le nom (chaîne), jamais l'objet : on garde le stand à part pour le rappel. */
  protected onPreviousStandSelected(event: AutoCompleteSelectEvent): void {
    const stand = event.value as PreviousStandDto;
    this.form.controls.companyName.setValue(stand.standName);
    this.previousStand.set(stand);
  }

  /** À la réouverture d'une inscription, retrouve le rappel si le nom enregistré est celui d'un stand précédent. */
  private restorePreviousStand(): void {
    const name = this.form.controls.companyName.value;
    if (this.formState.isReadOnly() || name.trim().length < 2) {
      return;
    }
    this.previousStandService
      .search(name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stands) => {
          const wanted = normalizeStandName(name);
          const match = stands.find((s) => normalizeStandName(s.standName) === wanted);
          // Le nom a pu changer pendant la requête.
          if (match && normalizeStandName(this.form.controls.companyName.value) === wanted) {
            this.previousStand.set(match);
          }
        },
        error: () => undefined,
      });
  }

  /**
   * `siret`/`activityDomainIds` ne sont requis que pour un exposant PRO, `clubType` que pour un
   * CLUB. On efface aussi la valeur du champ qui devient non pertinent pour ne pas garder de
   * donnée fantôme envoyée au back (ex: SIRET conservé après bascule PRO → CLUB).
   */
  private applyExhibitorTypeValidators(type: ExhibitorType): void {
    const { siret, standName, activityDomainIds, clubType } = this.form.controls;

    if (type === ExhibitorType.PRO) {
      siret.setValidators(Validators.required);
      activityDomainIds.setValidators(Validators.required);
      clubType.clearValidators();
      clubType.setValue(null, { emitEvent: false });
    } else {
      siret.clearValidators();
      activityDomainIds.clearValidators();
      siret.setValue(null, { emitEvent: false });
      standName.setValue(null, { emitEvent: false });
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

  protected isYearChecked(year: string): boolean {
    return this.form.controls.previousEditions.value?.includes(year) ?? false;
  }

  protected isNoneChecked(): boolean {
    return this.form.controls.previousEditions.value?.length === 0;
  }

  /**
   * Cocher une année décoche « Aucun ». Décocher la dernière année repasse à `null` et non à `[]`,
   * sans quoi l'exposant se retrouverait à avoir répondu « Aucun » sans l'avoir choisi.
   */
  protected onYearChange(year: string, checked: boolean): void {
    const current = this.form.controls.previousEditions.value ?? [];
    const next = checked ? [...new Set([...current, year])].sort() : current.filter((y) => y !== year);
    this.setPreviousEditions(next.length > 0 ? next : null);
  }

  /** « Aucun » est exclusif : le cocher efface les années, le décocher repasse à « pas répondu ». */
  protected onNoneChange(checked: boolean): void {
    this.setPreviousEditions(checked ? [] : null);
  }

  private setPreviousEditions(value: string[] | null): void {
    const control = this.form.controls.previousEditions;
    control.setValue(value);
    control.markAsTouched();
  }

  /** Le responsable à ajouter n'est pas dans le formulaire réactif : erreur de téléphone gérée à la main. */
  protected newManagerPhoneInvalid = false;

  protected addManager(): void {
    if (!this.newManager.firstName || !this.newManager.lastName || !this.newManager.email) {
      return;
    }
    if (!isValidOrEmptyPhone(this.newManager.phone)) {
      this.newManagerPhoneInvalid = true;
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
