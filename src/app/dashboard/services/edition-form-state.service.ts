import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AutosaveStatus,
  DocumentItem,
  DocumentKind,
  EditionRegistrationState,
  OptionCategory,
  RegistrationStatus,
  RegistrationStep,
  StandManagerForm,
} from '../models/edition-form.models';
import { getOptionById, OPTIONS_CATALOG } from '@app/dashboard/services/options-catalog';
import { loadMockRegistration } from '@app/dashboard/services/mock-registrations';
import { RegistrationService } from '@app/shared/services/registration.service';
import { DocumentService } from '@app/shared/services/document.service';
import { DocumentSummary } from '@app/core/models/document.model';

/** Délai avant déclenchement de la sauvegarde auto après la dernière modification (ms). */
const AUTOSAVE_DEBOUNCE_MS = 800;

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
  private readonly autosaveStatusSignal = signal<AutosaveStatus>('idle');
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly registrationService = inject(RegistrationService);
  private readonly documentService = inject(DocumentService);

  readonly registration = this.state.asReadonly();
  readonly activeStep = this.activeStepSignal.asReadonly();
  readonly autosaveStatus = this.autosaveStatusSignal.asReadonly();

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
          // Le devis (Task 4, cf. spec 2026-08-04-devis-docuseal-signature-design.md) devient
          // visible dès l'acceptation, avant que l'exposant ait fini l'étape Confirmation.
          return (
            reg.status === RegistrationStatus.ACCEPTED ||
            reg.status === RegistrationStatus.CONFIRMED ||
            reg.status === RegistrationStatus.COMPLETED
          );
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
    this.autosaveStatusSignal.set('idle');

    if (registration) {
      this.loadRealQuoteDocuments(year);
    }

    return registration !== null;
  }

  /**
   * Résout l'id réel de la Registration (via l'appel déjà réel RegistrationService.getMine()) puis
   * remplace le(s) document(s) de type 'quote' du mock par les documents réels de l'exposant.
   * Le reste de l'état (facture, assurance RC, liste fournisseurs...) reste mocké — cf. spec
   * 2026-08-04-devis-docuseal-signature-design.md §7 : périmètre volontairement limité au devis.
   */
  private loadRealQuoteDocuments(year: string): void {
    this.registrationService.getMine().subscribe({
      next: (response) => {
        const match = response.data.find((r) => r.edition.year === year);
        if (!match) {
          return;
        }

        this.state.update((reg) => (reg ? { ...reg, registrationId: match.id } : reg));

        this.documentService.getDocuments(match.id).subscribe({
          next: (docsResponse) => this.mergeRealQuoteDocuments(docsResponse.data),
          error: () => void 0, // section Documents garde son état mock/vide en cas d'échec réseau
        });
      },
      error: () => void 0,
    });
  }

  private mergeRealQuoteDocuments(documents: DocumentSummary[]): void {
    const quoteItems: DocumentItem[] = documents
      .filter((doc) => doc.type === 'quote')
      .map((doc) => ({
        id: doc.id,
        kind: 'quote' as DocumentKind,
        label: doc.label,
        visible: true,
        fileUrl: doc.fileUrl,
        signingUrl: doc.signingUrl,
        signed: doc.isSigned,
        uploadedAt: doc.notifiedAt ? new Date(doc.notifiedAt) : null,
      }));

    this.state.update((reg) => {
      if (!reg) {
        return reg;
      }
      const otherDocuments = reg.documents.filter((doc) => doc.kind !== 'quote');

      return { ...reg, documents: [...otherDocuments, ...quoteItems] };
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
   * Autosave debounced. Front-only pour cette itération : simule le cycle 'saving' → 'saved'
   * via un timer, sans appel réseau. Chaque mutation via `patchState` la redéclenche.
   *
   * TODO intégration : remplacer le corps du `setTimeout` par l'appel réel
   * `PATCH /api/registrations/{id}` (DTO partiel, cf. AbstractRestService côté back), en gardant
   * la même mécanique de debounce et les mêmes transitions de `autosaveStatusSignal` ('saving'
   * avant l'appel, 'saved' sur succès, 'error' sur échec réseau/validation serveur).
   */
  private scheduleAutosave(): void {
    if (this.isReadOnly()) {
      return;
    }
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
    }
    this.autosaveStatusSignal.set('saving');
    this.autosaveTimer = setTimeout(() => {
      this.autosaveStatusSignal.set('saved');
      this.autosaveTimer = null;
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  /**
   * TODO intégration : POST /api/registrations/{id}/submit.
   * Doit déclencher côté back la transition DRAFT → SUBMITTED (cf. RegistrationStatus::
   * allowedTransitions) et l'ActivityLogAction::REGISTRATION_SUBMITTED. Gérer les erreurs de
   * validation serveur (ex: champs PRO/CLUB requis manquants) en les remontant aux composants
   * via une exception typée plutôt qu'un message générique.
   *
   * Retourne un booléen (front-only) pour permettre au composant Stand d'afficher une
   * confirmation ; à remplacer par la réponse effective de l'appel HTTP.
   */
  submitRegistrationOptions(): boolean {
    const reg = this.state();
    if (!reg || !reg.stand.selectedSurfaceOptionId) {
      return false;
    }
    // no-op réseau (front only) — le back positionnera reg.status à SUBMITTED en réponse.
    return true;
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
   * Ouvre le lien de signature Docuseal hébergé dans un nouvel onglet. Le retour de signature
   * arrive via un mécanisme backend (hors périmètre actuel), pas via ce clic.
   */
  signQuote(documentId: string): void {
    const doc = this.state()?.documents.find((d) => d.id === documentId);
    if (doc?.signingUrl) {
      window.open(doc.signingUrl, '_blank', 'noopener');
    }
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
    this.scheduleAutosave();
  }
}
