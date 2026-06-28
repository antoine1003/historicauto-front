import { Injectable, computed, signal } from '@angular/core';
import {
  DocumentItem,
  EditionRegistrationState,
  OptionCategory,
  RegistrationStatus,
  RegistrationStep,
  StandManagerForm,
} from '../models/edition-form.models';
import { getOptionById, OPTIONS_CATALOG } from '@app/dashboard/services/options-catalog';
import { loadMockRegistration } from '@app/dashboard/services/mock-registrations';

/**
 * État central du formulaire d'inscription, partagé par les 5 étapes.
 *
 * À PROVIDER AU NIVEAU DE LA ROUTE (cf. edition-form.routes.ts), jamais en `providedIn: 'root'` :
 * chaque navigation vers /edition/:year doit repartir d'un état propre à cette édition, sans
 * fuite de données entre deux éditions consultées successivement.
 */
@Injectable()
export class EditionFormStateService {
  private readonly state = signal<EditionRegistrationState | null>(null);
  private readonly activeStepSignal = signal<RegistrationStep>(RegistrationStep.ENTITY);

  readonly registration = this.state.asReadonly();
  readonly activeStep = this.activeStepSignal.asReadonly();

  readonly isReadOnly = computed(() => this.state()?.readOnly ?? false);
  readonly editionYear = computed(() => this.state()?.editionYear ?? null);

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

  /** Total TTC du stand sélectionné (pack surface + options en quantité). */
  readonly standTotalTtc = computed(() => {
    const reg = this.state();
    if (!reg) {
      return 0;
    }

    let total = 0;
    if (reg.stand.selectedSurfaceOptionId) {
      total += getOptionById(reg.stand.selectedSurfaceOptionId)?.mockPriceTtc ?? 0;
    }
    for (const [optionId, quantity] of Object.entries(reg.stand.quantitiesByOptionId)) {
      total += (getOptionById(optionId)?.mockPriceTtc ?? 0) * quantity;
    }

    return total;
  });

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

  getOptionsByCategory(category: OptionCategory) {
    return OPTIONS_CATALOG.filter((option) => option.category === category);
  }

  /**
   * Charge le mock pour l'année donnée. Remplacer le corps de cette méthode par un appel HTTP
   * (ex: `this.registrationApi.getByEditionYear(year)`) consommé via un resolver de route ou un
   * effect, sans changer la signature ni les signals exposés ci-dessus — c'est ce qui permet aux
   * composants d'étape de ne jamais savoir si la donnée vient d'un mock ou de l'API.
   */
  loadForEditionYear(year: string): boolean {
    const registration = loadMockRegistration(year);
    this.state.set(registration);
    this.activeStepSignal.set(RegistrationStep.ENTITY);

    return registration !== null;
  }

  goToStep(step: RegistrationStep): void {
    if (this.isStepUnlocked()(step)) {
      this.activeStepSignal.set(step);
    }
  }

  updateEntity(patch: Partial<EditionRegistrationState['entity']>): void {
    this.patchState((reg) => ({ entity: { ...reg.entity, ...patch } }));
  }

  addManager(manager: StandManagerForm): void {
    this.patchState((reg) => ({ entity: { ...reg.entity, managers: [...reg.entity.managers, manager] } }));
  }

  removeManager(managerId: string): void {
    this.patchState((reg) => ({
      entity: { ...reg.entity, managers: reg.entity.managers.filter((m) => m.id !== managerId) },
    }));
  }

  selectSurfaceOption(optionId: string | null): void {
    this.patchState((reg) => ({ stand: { ...reg.stand, selectedSurfaceOptionId: optionId } }));
  }

  setOptionQuantity(optionId: string, quantity: number): void {
    this.patchState((reg) => ({
      stand: {
        ...reg.stand,
        quantitiesByOptionId: { ...reg.stand.quantitiesByOptionId, [optionId]: Math.max(0, quantity) },
      },
    }));
  }

  updateConfirmationChecklist(patch: Partial<EditionRegistrationState['confirmation']['checklist']>): void {
    this.patchState((reg) => ({
      confirmation: { ...reg.confirmation, checklist: { ...reg.confirmation.checklist, ...patch } },
    }));
  }

  updateSignatory(name: string, role: string): void {
    this.patchState((reg) => ({ confirmation: { ...reg.confirmation, signatoryName: name, signatoryRole: role } }));
  }

  // ---------------------------------------------------------------------------------------------
  // Méthodes volontairement non implémentées (front-only pour cette itération).
  // Chacune documente la cible d'intégration côté API REST Symfony existante.
  // ---------------------------------------------------------------------------------------------

  /**
   * TODO intégration : autosave de l'étape Entité/Stand.
   * Recommandation : déclencher via un `effect()` sur les signals concernés, avec un `debounceTime`
   * (rxjs `Subject` alimenté par l'effect, ou `toObservable` + `debounce`) d'environ 800ms, plutôt
   * qu'un appel à chaque frappe. Endpoint cible : PATCH /api/registrations/{id} (DTO partiel),
   * en réutilisant le pattern d'AbstractRestService côté back. Prévoir un indicateur visuel
   * "Enregistrement..." / "Enregistré" plutôt qu'un appel bloquant.
   */
  saveDraft(): void {
    // no-op (front only)
  }

  /**
   * TODO intégration : POST /api/registrations/{id}/submit.
   * Doit déclencher côté back la transition DRAFT → SUBMITTED (cf. RegistrationStatus::
   * allowedTransitions) et l'ActivityLogAction::REGISTRATION_SUBMITTED. Gérer les erreurs de
   * validation serveur (ex: champs PRO/CLUB requis manquants) en les remontant aux composants
   * via une exception typée plutôt qu'un message générique.
   */
  submitRegistrationOptions(): void {
    // no-op (front only)
  }

  /**
   * TODO intégration : confirmation définitive de l'étape 3.
   * Endpoint cible : POST /api/registrations/{id}/confirm avec le nom/fonction du signataire.
   * Le back doit horodater `confirmedAt` et persister une RegistrationSignature (entité déjà
   * prévue) plutôt que de laisser le front fixer la date - la date affichée ici doit rester un
   * simple `new Date()` d'affichage tant que le back n'a pas répondu.
   */
  confirmRegistration(): void {
    const allChecked = Object.values(this.state()?.confirmation.checklist ?? {}).every(Boolean);
    if (!allChecked) {
      return;
    }
    // no-op au-delà de la validation locale (front only)
  }

  /**
   * TODO intégration : ouverture du plugin de signature (Docuseal) pour le document `documentId`.
   * Le retour de signature doit arriver via webhook côté back (qui met à jour `Document::signed`
   * et journalise ActivityLogAction::QUOTE_SIGNED), pas via un callback front qu'on pourrait
   * usurper. Le front se contente de rafraîchir l'état après une notification/poll.
   */
  signQuote(documentId: string): void {
    void documentId; // no-op (front only)
  }

  /**
   * TODO intégration : upload de l'assurance RC.
   * Endpoint cible : POST /api/registrations/{id}/documents (multipart), type=insurance.
   * Toujours garder le dernier fichier téléversé en remplaçant l'ancien (cf. cahier des charges :
   * "garder toujours la dernière téléversée en téléchargement"), donc upsert côté back plutôt
   * qu'accumulation de lignes Document.
   */
  uploadInsuranceDocument(file: File): void {
    void file; // no-op (front only)
  }

  private patchState(producer: (reg: EditionRegistrationState) => Partial<EditionRegistrationState>): void {
    if (this.isReadOnly()) {
      return;
    }
    this.state.update((reg) => (reg ? { ...reg, ...producer(reg) } : reg));
  }
}
