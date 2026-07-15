import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import {
  AutosaveStatus,
  EditionRegistrationState,
  EntityStepPayload,
  EntityStepState,
  OptionCategory,
  OptionDefinition,
  RegistrationStatus,
  RegistrationStep,
  StandManagerForm,
  StandStepPayload,
  StandStepState,
} from '../models/edition-form.models';
import {
  EntityStepApiDto,
  RegistrationDetailApiDto,
  StandStepApiDto,
} from '../models/registration-api.models';
import { RegistrationService } from '@app/shared/services/registration.service';
import { OptionsCatalogService } from '@app/dashboard/services/options-catalog.service';

/** Délai avant déclenchement de la sauvegarde auto après la dernière modification (ms). */
const AUTOSAVE_DEBOUNCE_MS = 800;

/**
 * État central du formulaire d'inscription, partagé par les 5 étapes.
 *
 * À PROVIDER AU NIVEAU DE LA ROUTE (cf. dashboard.routes.ts), jamais en `providedIn: 'root'` :
 * chaque navigation vers /edition/:year doit repartir d'un état propre à cette édition, sans
 * fuite de données entre deux éditions consultées successivement.
 */
@Injectable()
export class EditionFormStateService {
  private readonly registrationService = inject(RegistrationService);
  private readonly optionsCatalogService = inject(OptionsCatalogService);
  private readonly messageService = inject(MessageService);

  private readonly state = signal<EditionRegistrationState | null>(null);
  private readonly activeStepSignal = signal<RegistrationStep>(RegistrationStep.ENTITY);
  private readonly optionsSignal = signal<OptionDefinition[]>([]);
  private readonly entityAutosaveStatusSignal = signal<AutosaveStatus>('idle');
  private readonly standAutosaveStatusSignal = signal<AutosaveStatus>('idle');
  private readonly loadingSignal = signal(false);
  private readonly loadErrorSignal = signal<'not_found' | 'closed' | null>(null);
  private entityAutosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private standAutosaveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly registration = this.state.asReadonly();
  readonly activeStep = this.activeStepSignal.asReadonly();
  readonly entityAutosaveStatus = this.entityAutosaveStatusSignal.asReadonly();
  readonly standAutosaveStatus = this.standAutosaveStatusSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly loadError = this.loadErrorSignal.asReadonly();

  readonly isReadOnly = computed(() => this.state()?.readOnly ?? false);
  readonly editionYear = computed(() => this.state()?.editionYear ?? null);

  /** Ordre linéaire du stepper pour les boutons Suivant/Précédent. */
  private readonly stepOrder: RegistrationStep[] = [
    RegistrationStep.ENTITY,
    RegistrationStep.STAND,
    RegistrationStep.CONFIRMATION,
    RegistrationStep.DOCUMENTS,
    RegistrationStep.PAYMENT,
  ];

  /**
   * Règle de navigation du stepper : tant qu'on est en lecture seule (historique), tout est
   * cliquable. En édition active, on suit la règle du cahier des charges — étapes 1 et 2
   * toujours accessibles, étape 3 accessible une fois le stand renseigné, étapes 4 et 5
   * débloquées seulement après confirmation (statut backend, pas une règle front à dupliquer).
   */
  readonly isStepUnlocked = computed(() => {
    const reg = this.state();
    if (!reg) {
      return () => false;
    }
    if (reg.readOnly) {
      return () => true;
    }

    return (step: RegistrationStep): boolean => {
      switch (step) {
        case RegistrationStep.ENTITY:
        case RegistrationStep.STAND:
          return true;
        case RegistrationStep.CONFIRMATION:
          return this.standTotalTtc() > 0;
        case RegistrationStep.DOCUMENTS:
        case RegistrationStep.PAYMENT:
          return reg.status === RegistrationStatus.CONFIRMED || reg.status === RegistrationStatus.COMPLETED;
        default:
          return false;
      }
    };
  });

  /** Calculé côté serveur, source de vérité (cf. Registration::computeOptionsTotal() côté back). */
  readonly standTotalTtc = computed(() => this.state()?.stand.standTotalTtc ?? 0);

  readonly paymentsTotalTtc = computed(() => {
    const reg = this.state();
    return reg ? reg.payment.payments.reduce((sum, payment) => sum + payment.amountTtc, 0) : 0;
  });

  readonly balanceDueTtc = computed(() => {
    const reg = this.state();
    if (!reg) {
      return 0;
    }
    const discounted = this.standTotalTtc() * (1 - reg.payment.discountPercent / 100);
    const orderTotal = discounted + reg.payment.fileFeeTtc;

    return orderTotal - this.paymentsTotalTtc();
  });

  getOptionsByCategory(category: OptionCategory): OptionDefinition[] {
    return this.optionsSignal().filter((option) => option.category === category);
  }

  private getOptionById(id: string): OptionDefinition | undefined {
    return this.optionsSignal().find((option) => option.id === id);
  }

  /**
   * Charge l'inscription réelle pour l'année donnée (get-or-create côté back). Asynchrone :
   * `loading`/`loadError` reflètent l'état de la requête, `registration()` reste `null` tant
   * qu'elle n'a pas abouti.
   */
  loadForEditionYear(year: string): void {
    this.loadingSignal.set(true);
    this.loadErrorSignal.set(null);
    this.state.set(null);
    this.activeStepSignal.set(RegistrationStep.ENTITY);
    this.entityAutosaveStatusSignal.set('idle');
    this.standAutosaveStatusSignal.set('idle');

    this.optionsCatalogService.getForEdition(year).subscribe({
      next: (options) => this.optionsSignal.set(options),
      error: () => this.optionsSignal.set([]),
    });

    this.registrationService
      .getByEditionYear(year)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          this.loadErrorSignal.set(err.status === 403 ? 'closed' : 'not_found');
          return of(null);
        }),
      )
      .subscribe((response) => {
        this.loadingSignal.set(false);
        if (!response) {
          return;
        }
        this.state.set(this.toEditionRegistrationState(response.data));
      });
  }

  goToStep(step: RegistrationStep): void {
    if (this.isStepUnlocked()(step)) {
      this.activeStepSignal.set(step);
    }
  }

  /**
   * Navigation séquentielle "Suivant". La garde métier réelle (empêcher d'avancer avec un
   * formulaire invalide) est portée par `[disabled]="!formGroup.valid"` côté composant d'étape,
   * cette méthode ne fait que déplacer le curseur une fois que le bouton a été activé.
   */
  goToNextStep(): void {
    const currentIndex = this.stepOrder.indexOf(this.activeStepSignal());
    const next = this.stepOrder[currentIndex + 1];
    if (next !== undefined) {
      this.goToStep(next);
    }
  }

  goToPreviousStep(): void {
    const currentIndex = this.stepOrder.indexOf(this.activeStepSignal());
    const previous = this.stepOrder[currentIndex - 1];
    if (previous !== undefined) {
      this.goToStep(previous);
    }
  }

  readonly isFirstStep = computed(() => this.stepOrder.indexOf(this.activeStepSignal()) === 0);
  readonly isLastStep = computed(
    () => this.stepOrder.indexOf(this.activeStepSignal()) === this.stepOrder.length - 1,
  );

  updateEntity(patch: Partial<EditionRegistrationState['entity']>): void {
    this.patchLocalState((reg) => ({ entity: { ...reg.entity, ...patch } }));
    this.scheduleEntityAutosave();
  }

  addManager(manager: StandManagerForm): void {
    this.patchLocalState((reg) => ({ entity: { ...reg.entity, managers: [...reg.entity.managers, manager] } }));
  }

  removeManager(managerId: string): void {
    this.patchLocalState((reg) => ({
      entity: { ...reg.entity, managers: reg.entity.managers.filter((m) => m.id !== managerId) },
    }));
  }

  selectSurfaceOption(optionId: string | null): void {
    this.patchLocalState((reg) => ({ stand: { ...reg.stand, selectedSurfaceOptionId: optionId } }));
    this.scheduleStandAutosave();
  }

  setOptionQuantity(optionId: string, quantity: number): void {
    this.patchLocalState((reg) => ({
      stand: {
        ...reg.stand,
        quantitiesByOptionId: { ...reg.stand.quantitiesByOptionId, [optionId]: Math.max(0, quantity) },
      },
    }));
    this.scheduleStandAutosave();
  }

  updateConfirmationChecklist(patch: Partial<EditionRegistrationState['confirmation']['checklist']>): void {
    this.patchLocalState((reg) => ({
      confirmation: { ...reg.confirmation, checklist: { ...reg.confirmation.checklist, ...patch } },
    }));
  }

  updateSignatory(name: string, role: string): void {
    this.patchLocalState((reg) => ({ confirmation: { ...reg.confirmation, signatoryName: name, signatoryRole: role } }));
  }

  // ---------------------------------------------------------------------------------------------
  // Méthodes volontairement non implémentées (front-only pour cette itération — Étapes 3-5).
  // ---------------------------------------------------------------------------------------------

  submitRegistrationOptions(): boolean {
    const reg = this.state();
    if (!reg || !reg.stand.selectedSurfaceOptionId) {
      return false;
    }
    return true;
  }

  confirmRegistration(): void {
    const allChecked = Object.values(this.state()?.confirmation.checklist ?? {}).every(Boolean);
    if (!allChecked) {
      return;
    }
  }

  signQuote(documentId: string): void {
    void documentId; // no-op (front only, étape 4 hors périmètre)
  }

  uploadInsuranceDocument(file: File): void {
    void file; // no-op (front only, étape 4 hors périmètre)
  }

  private scheduleEntityAutosave(): void {
    if (this.isReadOnly()) {
      return;
    }
    if (this.entityAutosaveTimer) {
      clearTimeout(this.entityAutosaveTimer);
    }
    this.entityAutosaveStatusSignal.set('saving');
    this.entityAutosaveTimer = setTimeout(() => {
      const reg = this.state();
      if (!reg) {
        return;
      }
      const payload: EntityStepPayload = {
        exhibitorType: reg.entity.exhibitorType,
        companyName: reg.entity.companyName,
        siret: reg.entity.siret,
        activityDomainId: reg.entity.activityDomainId,
        clubType: reg.entity.clubType,
      };
      this.registrationService.patchEntity(reg.id, payload).subscribe({
        next: (response) => {
          this.state.update((current) =>
            current ? { ...current, entity: this.toEntityStepState(response.data) } : current,
          );
          this.entityAutosaveStatusSignal.set('saved');
        },
        error: () => {
          this.entityAutosaveStatusSignal.set('error');
          this.messageService.add({
            severity: 'error',
            summary: 'Échec de la sauvegarde',
            detail: "Vos informations d'entité n'ont pas pu être enregistrées. Nouvel essai à la prochaine modification.",
          });
        },
      });
      this.entityAutosaveTimer = null;
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  private scheduleStandAutosave(): void {
    if (this.isReadOnly()) {
      return;
    }
    if (this.standAutosaveTimer) {
      clearTimeout(this.standAutosaveTimer);
    }
    this.standAutosaveStatusSignal.set('saving');
    this.standAutosaveTimer = setTimeout(() => {
      const reg = this.state();
      if (!reg) {
        return;
      }
      const payload: StandStepPayload = {
        selectedSurfaceOptionId: reg.stand.selectedSurfaceOptionId,
        quantitiesByOptionId: reg.stand.quantitiesByOptionId,
      };
      this.registrationService.patchStand(reg.id, payload).subscribe({
        next: (response) => {
          this.state.update((current) =>
            current ? { ...current, stand: this.toStandStepState(response.data) } : current,
          );
          this.standAutosaveStatusSignal.set('saved');
        },
        error: () => {
          this.standAutosaveStatusSignal.set('error');
          this.messageService.add({
            severity: 'error',
            summary: 'Échec de la sauvegarde',
            detail: "Vos options de stand n'ont pas pu être enregistrées. Nouvel essai à la prochaine modification.",
          });
        },
      });
      this.standAutosaveTimer = null;
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  // ---------------------------------------------------------------------------------------------
  // Mapping DTO API → état interne
  // ---------------------------------------------------------------------------------------------

  private toEditionRegistrationState(dto: RegistrationDetailApiDto): EditionRegistrationState {
    return {
      id: dto.id,
      editionYear: dto.editionYear,
      status: dto.status as RegistrationStatus,
      readOnly: dto.readOnly,
      entity: this.toEntityStepState(dto.entity),
      stand: this.toStandStepState(dto.stand),
      confirmation: {
        checklist: { ...dto.confirmation.checklist },
        signatoryName: dto.confirmation.signatoryName,
        signatoryRole: dto.confirmation.signatoryRole,
        confirmedAt: dto.confirmation.confirmedAt ? new Date(dto.confirmation.confirmedAt) : null,
      },
      documents: [],
      payment: {
        standTotalTtc: dto.payment.standTotalTtc,
        discountPercent: dto.payment.discountPercent,
        fileFeeTtc: dto.payment.fileFeeTtc,
        depositRatePercent: dto.payment.depositRatePercent,
        balanceDueDate: dto.payment.balanceDueDate ? new Date(dto.payment.balanceDueDate) : null,
        payments: [],
      },
    };
  }

  private toEntityStepState(dto: EntityStepApiDto): EntityStepState {
    return {
      exhibitorType: dto.exhibitorType as EditionRegistrationState['entity']['exhibitorType'],
      companyName: dto.companyName,
      siret: dto.siret,
      activityDomainId: dto.activityDomainId,
      clubType: dto.clubType as EditionRegistrationState['entity']['clubType'],
      visualUrl: dto.visualUrl,
      managers: dto.managers.map((m) => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        phone: m.phone ?? '',
        email: m.email,
      })),
    };
  }

  private toStandStepState(dto: StandStepApiDto): StandStepState {
    return {
      selectedSurfaceOptionId: dto.selectedSurfaceOptionId,
      quantitiesByOptionId: dto.quantitiesByOptionId,
      standTotalTtc: dto.standTotalTtc,
    };
  }

  private patchLocalState(producer: (reg: EditionRegistrationState) => Partial<EditionRegistrationState>): void {
    if (this.isReadOnly()) {
      return;
    }
    this.state.update((reg) => (reg ? { ...reg, ...producer(reg) } : reg));
  }
}
