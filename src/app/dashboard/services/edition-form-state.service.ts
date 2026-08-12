import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { environment } from '../../../environments/environment';
import {
  AutosaveStatus,
  DocumentItem,
  DocumentKind,
  EditionRegistrationState,
  EntityStepPayload,
  EntityStepState,
  NewManagerPayload,
  OptionCategory,
  OptionDefinition,
  RegistrationStatus,
  RegistrationStep,
  StandManagerForm,
  StandStepPayload,
  StandStepState,
} from '../models/edition-form.models';
import { RegistrationService } from '@app/shared/services/registration.service';
import { DocumentService } from '@app/shared/services/document.service';
import { DocumentSummary } from '@app/core/models/document.model';
import { EntityStepApiDto, RegistrationDetailApiDto, StandStepApiDto, } from '../models/registration-api.models';
import { OptionsCatalogService } from '@app/dashboard/services/options-catalog.service';

/** Délai avant déclenchement de la sauvegarde auto après la dernière modification (ms). */
const AUTOSAVE_DEBOUNCE_MS = 800;

/** Origine du backend (sans /api), pour résoudre les URLs relatives renvoyées par l'API (ex: visuel exposant). */
const API_ORIGIN = environment.apiUrl.replace(/\/api\/?$/, '');

function toAbsoluteUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url}`;
}

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
  private readonly documentService = inject(DocumentService);
  private readonly optionsSignal = signal<OptionDefinition[]>([]);
  private readonly entityAutosaveStatusSignal = signal<AutosaveStatus>('idle');
  private readonly standAutosaveStatusSignal = signal<AutosaveStatus>('idle');
  private readonly loadingSignal = signal(false);
  private readonly loadErrorSignal = signal<'not_found' | 'closed' | null>(null);
  private readonly submitStatusSignal = signal<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  private readonly confirmStatusSignal = signal<'idle' | 'submitting' | 'error'>('idle');
  private entityAutosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private standAutosaveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly registration = this.state.asReadonly();
  readonly activeStep = this.activeStepSignal.asReadonly();
  readonly entityAutosaveStatus = this.entityAutosaveStatusSignal.asReadonly();
  readonly standAutosaveStatus = this.standAutosaveStatusSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly loadError = this.loadErrorSignal.asReadonly();
  readonly submitStatus = this.submitStatusSignal.asReadonly();
  readonly confirmStatus = this.confirmStatusSignal.asReadonly();

  readonly isReadOnly = computed(() => this.state()?.readOnly ?? false);
  readonly editionYear = computed(() => this.state()?.editionYear ?? null);

  /**
   * TODO: - Ajouter le bouton pour télécharger les documents et le devis
   *       - Revoir comment fonctionne le step de confirmation.
   *       - "Édition passée — ce formulaire est affiché à titre d'historique et n'est plus modifiable." Ce texte n'est pas correct
   *       - Bien rester sur les branches develop et supprimer les autre
   *       - Revoir le systeme readonly sur le formulaire. Il ne doit pas être désactivé partout.
   */

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

    return (step: RegistrationStep): boolean => {
      switch (step) {
        case RegistrationStep.ENTITY:
        case RegistrationStep.STAND:
          return true;
        case RegistrationStep.CONFIRMATION:
          // Débloquée dès qu'un devis a été validé et rendu visible par HA (cf. spec
          // 2026-08-11-devis-confirmation-signature-design.md) — plus lié au total du stand.
          // confirmedAt garde l'étape consultable pour une inscription déjà confirmée (ex. vue
          // historique), sans réintroduire le bug "reg.readOnly ≈ pas DRAFT" (pas "édition passée").
          return reg.documents.some((doc) => doc.kind === 'quote') || reg.confirmation.confirmedAt !== null;
        case RegistrationStep.DOCUMENTS:
          // Débloquée uniquement une fois la confirmation soumise (génère le lien de signature) —
          // avant CONFIRMED, le devis est consultable via le lien de l'Étape 3, pas via cet onglet.
          // Ne suit PAS reg.readOnly : sinon toute inscription non-DRAFT (donc aussi ACCEPTED, pas
          // encore confirmée) débloquerait cet onglet prématurément.
          return reg.status === RegistrationStatus.CONFIRMED || reg.status === RegistrationStatus.COMPLETED;
        case RegistrationStep.PAYMENT:
          // Débloquée seulement après signature effective du devis (webhook Docuseal), pas dès la
          // simple confirmation — cf. spec 2026-08-12-docuseal-webhook-signature-design.md §7.2.
          return (
            reg.readOnly ||
            reg.status === RegistrationStatus.COMPLETED ||
            reg.documents.some((doc) => doc.kind === 'quote' && doc.signatureStatus === 'signed')
          );
        default:
          return false;
      }
    };
  });

  /** Calculé côté serveur, source de vérité (cf. Registration::computeOptionsTotal() côté back). */
  readonly standTotalTtc = computed(() => this.state()?.stand.standTotalTtc ?? 0);

  /**
   * L'Étape 3 n'est modifiable que tant que l'inscription est ACCEPTED et pas encore confirmée —
   * une fois CONFIRMED, les champs redeviennent en lecture seule via cette garde dédiée plutôt
   * que via le flag global `isReadOnly` (cf. spec 2026-08-11-..., §4.4 : ce dernier reste true
   * dès que le statut quitte DRAFT, ce qui désactiverait ce formulaire trop tôt si on le réutilisait ici).
   */
  readonly isConfirmationEditable = computed(() => {
    const reg = this.state();
    if (!reg) {
      return false;
    }
    return reg.status === RegistrationStatus.ACCEPTED && reg.confirmation.confirmedAt === null;
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

  getOptionsByCategory(category: OptionCategory): OptionDefinition[] {
    const exhibitorType = this.state()?.entity.exhibitorType ?? null;
    return this.optionsSignal().filter(
      (option) =>
        option.category === category &&
        (option.exhibitorType === null || option.exhibitorType === exhibitorType),
    );
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

        this.loadRealQuoteDocuments(year);
        this.state.set(this.toEditionRegistrationState(response.data));
      });
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
          console.warn(`[EditionFormStateService] Aucune inscription réelle trouvée pour l'année ${year}.`);
          return;
        }

        this.state.update((reg) =>
          reg
            ? {
                ...reg,
                registrationId: match.id,
                status: match.status as RegistrationStatus,
                editionYear: match.edition.year,
              }
            : reg,
        );

        this.documentService.getDocuments(match.id).subscribe({
          next: (docsResponse) => this.mergeRealQuoteDocuments(docsResponse.data),
          error: (err) => console.warn('[EditionFormStateService] Échec du chargement des documents réels :', err),
        });
      },
      error: (err) => console.warn('[EditionFormStateService] Échec du chargement de la registration réelle :', err),
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
        fileUrl: doc.fileUrl ? toAbsoluteUrl(doc.fileUrl) : null,
        signingUrl: doc.signingUrl,
        signatureStatus: doc.signatureStatus,
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
    this.patchLocalState((reg) => ({ entity: { ...reg.entity, ...patch } }));
    this.scheduleEntityAutosave();
  }

  addManager(manager: Omit<StandManagerForm, 'id'>): void {
    const reg = this.state();
    if (!reg || this.isReadOnly()) {
      return;
    }
    const optimisticId = `temp-${crypto.randomUUID()}`;
    const optimisticManager: StandManagerForm = { id: optimisticId, ...manager };
    this.state.update((current) =>
      current
        ? { ...current, entity: { ...current.entity, managers: [...current.entity.managers, optimisticManager] } }
        : current,
    );

    const payload: NewManagerPayload = {
      firstName: manager.firstName,
      lastName: manager.lastName,
      phone: manager.phone || null,
      email: manager.email,
    };

    this.registrationService.addManager(reg.id, payload).subscribe({
      next: (response) => {
        this.state.update((current) =>
          current
            ? {
                ...current,
                entity: {
                  ...current.entity,
                  managers: current.entity.managers.map((m) =>
                    m.id === optimisticId
                      ? {
                          id: response.data.id,
                          firstName: response.data.firstName,
                          lastName: response.data.lastName,
                          phone: response.data.phone ?? '',
                          email: response.data.email,
                        }
                      : m,
                  ),
                },
              }
            : current,
        );
      },
      error: () => {
        this.state.update((current) =>
          current
            ? { ...current, entity: { ...current.entity, managers: current.entity.managers.filter((m) => m.id !== optimisticId) } }
            : current,
        );
        this.messageService.add({
          severity: 'error',
          summary: 'Échec',
          detail: "Le responsable de stand n'a pas pu être ajouté.",
        });
      },
    });
  }

  removeManager(managerId: string): void {
    const reg = this.state();
    if (!reg || this.isReadOnly()) {
      return;
    }

    this.registrationService.removeManager(reg.id, managerId).subscribe({
      next: () => {
        this.state.update((current) =>
          current
            ? { ...current, entity: { ...current.entity, managers: current.entity.managers.filter((m) => m.id !== managerId) } }
            : current,
        );
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Échec',
          detail: "Le responsable de stand n'a pas pu être supprimé.",
        });
      },
    });
  }

  uploadLogo(file: File): void {
    const reg = this.state();
    if (!reg || this.isReadOnly()) {
      return;
    }

    this.registrationService.uploadLogo(reg.id, file).subscribe({
      next: (response) => {
        this.state.update((current) =>
          current
            ? { ...current, entity: { ...current.entity, visualUrl: toAbsoluteUrl(response.data.url) } }
            : current,
        );
        this.messageService.add({
          severity: 'success',
          summary: 'Visuel téléversé',
          detail: 'Votre visuel a bien été enregistré.',
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Échec',
          detail: "Le visuel n'a pas pu être téléversé.",
        });
      },
    });
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
    if (!this.isConfirmationEditable()) {
      return;
    }
    this.state.update((reg) =>
      reg
        ? { ...reg, confirmation: { ...reg.confirmation, checklist: { ...reg.confirmation.checklist, ...patch } } }
        : reg,
    );
  }

  updateSignatory(name: string, role: string): void {
    if (!this.isConfirmationEditable()) {
      return;
    }
    this.state.update((reg) =>
      reg ? { ...reg, confirmation: { ...reg.confirmation, signatoryName: name, signatoryRole: role } } : reg,
    );
  }

  submitRegistrationOptions(): void {
    const reg = this.state();
    if (!reg || !reg.stand.selectedSurfaceOptionId) {
      return;
    }

    this.submitStatusSignal.set('submitting');
    this.registrationService.submit(reg.id).subscribe({
      next: (response) => {
        this.state.update((current) =>
          current ? { ...current, status: response.data.status as RegistrationStatus } : current,
        );
        this.submitStatusSignal.set('submitted');
      },
      error: (err: HttpErrorResponse) => {
        this.submitStatusSignal.set('error');
        const errors = (err.error?.errors ?? {}) as Record<string, string[]>;
        const detail =
          Object.values(errors).flat().join(' ') || "Votre demande n'a pas pu être envoyée.";
        this.messageService.add({ severity: 'error', summary: 'Formulaire incomplet', detail });
      },
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Méthodes volontairement non implémentées (front-only pour cette itération — Étapes 3-4).
  // ---------------------------------------------------------------------------------------------

  confirmRegistration(): void {
    const reg = this.state();
    if (!reg) {
      return;
    }
    const allChecked = Object.values(reg.confirmation.checklist).every(Boolean);
    if (!allChecked || !reg.confirmation.signatoryName || !reg.confirmation.signatoryRole) {
      return;
    }

    this.confirmStatusSignal.set('submitting');
    this.registrationService
      .confirmRegistration(reg.id, {
        checklist: reg.confirmation.checklist,
        signatoryName: reg.confirmation.signatoryName,
        signatoryRole: reg.confirmation.signatoryRole,
      })
      .subscribe({
        next: (response) => {
          this.state.update((current) =>
            current
              ? {
                  ...current,
                  status: response.data.status as RegistrationStatus,
                  confirmation: {
                    checklist: { ...response.data.confirmation.checklist },
                    signatoryName: response.data.confirmation.signatoryName,
                    signatoryRole: response.data.confirmation.signatoryRole,
                    confirmedAt: response.data.confirmation.confirmedAt
                      ? new Date(response.data.confirmation.confirmedAt)
                      : null,
                  },
                }
              : current,
          );
          this.confirmStatusSignal.set('idle');

          this.documentService.getDocuments(reg.id).subscribe({
            next: (docsResponse) => this.mergeRealQuoteDocuments(docsResponse.data),
            error: (err) => console.warn('[EditionFormStateService] Échec du rechargement des documents après confirmation :', err),
          });

          this.goToStep(RegistrationStep.DOCUMENTS);
        },
        error: (err: HttpErrorResponse) => {
          this.confirmStatusSignal.set('error');
          const errors = (err.error?.errors ?? {}) as Record<string, string[]>;
          const detail =
            Object.values(errors).flat().join(' ') ||
            err.error?.message ||
            "La confirmation a échoué. Réessayez.";
          this.messageService.add({ severity: 'error', summary: 'Confirmation impossible', detail });
        },
      });
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
   * Recharge les documents réels de l'inscription — utilisé au retour de focus après un aller-retour
   * sur l'onglet de signature Docuseal, pour récupérer le nouvel état sans rechargement de page.
   */
  refreshDocuments(): void {
    const registrationId = this.state()?.registrationId;
    if (!registrationId) {
      return;
    }
    this.documentService.getDocuments(registrationId).subscribe({
      next: (response) => this.mergeRealQuoteDocuments(response.data),
      error: (err) => console.warn('[EditionFormStateService] Échec du rafraîchissement des documents :', err),
    });
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
      registrationId: dto.id,
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
      visualUrl: dto.visualUrl ? toAbsoluteUrl(dto.visualUrl) : null,
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
