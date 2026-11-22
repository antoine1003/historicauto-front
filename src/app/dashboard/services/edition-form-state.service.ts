import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, concatMap, from, map, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { environment } from '../../../environments/environment';
import {
  AutosaveStatus,
  DocumentItem,
  EditionRegistrationState,
  EntityStepPayload,
  EntityStepState,
  NewManagerPayload,
  OptionGroupBehaviour,
  OptionGroupDefinition,
  PARTITION_SEGMENT_COUNTS,
  PartitionDetailForm,
  RegistrationStatus,
  RegistrationStep,
  StandManagerForm,
  StandStepPayload,
  StandStepState,
  STRUCTURE_MAX_ATTACHMENTS,
  STRUCTURE_MAX_FILE_SIZE_BYTES,
  StructureAttachment,
} from '../models/edition-form.models';
import { RegistrationService } from '@app/shared/services/registration.service';
import { DocumentService } from '@app/shared/services/document.service';
import { DocumentSummary, SharedDocumentItem } from '@app/core/models/document.model';
import { EntityStepApiDto, RegistrationDetailApiDto, StandStepApiDto, StructureAttachmentApiDto, } from '../models/registration-api.models';
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
  private readonly router = inject(Router);

  private readonly state = signal<EditionRegistrationState | null>(null);
  private readonly activeStepSignal = signal<RegistrationStep>(RegistrationStep.ENTITY);
  private readonly documentService = inject(DocumentService);
  private readonly optionGroupsSignal = signal<OptionGroupDefinition[]>([]);
  /** Bascule à true si le chargement du catalogue d'options a échoué (cf. revue finale). */
  private readonly catalogLoadFailedSignal = signal(false);
  /**
   * Type d'exposant connu du serveur au chargement du catalogue. Les packs de surface Pro et Club
   * sont des options distinctes : quand l'étape Entité change ce type, le catalogue est rechargé.
   */
  private catalogExhibitorType: string | null = null;
  private readonly sharedDocumentsSignal = signal<SharedDocumentItem[]>([]);
  private readonly entityAutosaveStatusSignal = signal<AutosaveStatus>('idle');
  private readonly standAutosaveStatusSignal = signal<AutosaveStatus>('idle');
  private readonly loadingSignal = signal(false);
  private readonly loadErrorSignal = signal<'not_found' | 'closed' | null>(null);
  private readonly submitStatusSignal = signal<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  private readonly confirmStatusSignal = signal<'idle' | 'submitting' | 'error'>('idle');
  private entityAutosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private standAutosaveTimer: ReturnType<typeof setTimeout> | null = null;
  /** Numéro de la dernière requête PATCH stand réellement envoyée. */
  private standSaveSeq = 0;
  /** Plus haut numéro de requête PATCH stand dont la réponse a été un succès. */
  private standSavedSeq = 0;
  private standSavesInFlight = 0;
  /** Un état local plus récent doit être envoyé dès que les requêtes en vol sont terminées. */
  private standResendQueued = false;
  /** Actions en attente d'une requête donnée (cf. whenStandSaved()). */
  private standSaveWaiters: Array<{ requiredSeq: number; done: () => void; failed: () => void }> = [];
  private readonly structureUploadingSignal = signal(false);
  private readonly structureUploadErrorsSignal = signal<string[]>([]);
  /** Pièces jointes dont la suppression est en cours (évite le double envoi au double-clic). */
  private readonly structureRemovingIdsSignal = signal<ReadonlySet<string>>(new Set());
  private readonly checkoutInProgressSignal = signal(false);
  /**
   * Étape demandée à l'ouverture (`?step=…` d'un lien d'email, ou Paiement au retour de Stripe),
   * appliquée dès qu'elle est accessible. Les règles de isStepUnlocked dépendent du statut et des
   * documents réels (devis présent, devis signé), qui n'arrivent qu'après la réponse principale via
   * loadRealQuoteDocuments() → mergeRealDocuments() : sans ce report, goToStep() échouerait
   * silencieusement pour Confirmation/Documents/Paiement (cf. revue finale Stripe). Consommée une
   * seule fois : si l'étape est encore verrouillée une fois les documents chargés, on reste sur
   * l'étape par défaut. Annulée dès que l'exposant change lui-même d'onglet.
   */
  private pendingStep: RegistrationStep | null = null;

  constructor() {
    // Filet de sécurité bfcache : si le navigateur restaure cette page depuis le cache
    // arrière/avant après un retour en arrière post-redirection Stripe, `checkoutInProgress`
    // pourrait rester bloqué à `true` (le rechargement JS normal qui le remettrait à `false`
    // n'a pas lieu lors d'une restauration bfcache).
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        this.checkoutInProgressSignal.set(false);
      }
    });
  }

  readonly registration = this.state.asReadonly();
  /** Sections d'options de l'édition courante, ordonnées par le serveur. */
  readonly optionGroups = this.optionGroupsSignal.asReadonly();
  readonly catalogLoadFailed = this.catalogLoadFailedSignal.asReadonly();
  readonly sharedDocuments = this.sharedDocumentsSignal.asReadonly();
  readonly activeStep = this.activeStepSignal.asReadonly();
  readonly entityAutosaveStatus = this.entityAutosaveStatusSignal.asReadonly();
  readonly standAutosaveStatus = this.standAutosaveStatusSignal.asReadonly();
  readonly structureUploading = this.structureUploadingSignal.asReadonly();
  readonly structureUploadErrors = this.structureUploadErrorsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly loadError = this.loadErrorSignal.asReadonly();
  readonly submitStatus = this.submitStatusSignal.asReadonly();
  readonly confirmStatus = this.confirmStatusSignal.asReadonly();
  readonly checkoutInProgress = this.checkoutInProgressSignal.asReadonly();

  readonly isReadOnly = computed(() => this.state()?.readOnly ?? false);
  readonly isEditionClosed = computed(() => this.state()?.editionClosed ?? false);
  readonly editionYear = computed(() => this.state()?.editionYear ?? null);
  /** Assurance RC courante de l'inscription, ou null si l'exposant n'en a pas encore déposé. */
  readonly insuranceDocument = computed(
    () => this.state()?.documents.find((doc) => doc.kind === 'insurance') ?? null,
  );

  /**
   * TODO: - Ajouter le bouton pour télécharger les documents et le devis
   *       - Revoir comment fonctionne le step de confirmation.
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
          // Débloquée dès l'acceptation : c'est à partir de là que HA envoie des documents
          // (documents publiés, documents communs, assurance RC). Avant la confirmation, le devis
          // n'y figure pas (cf. StepDocumentsComponent.visibleDocuments) : il se consulte depuis
          // l'onglet Confirmation. Un document publié par HA avant l'acceptation ouvre aussi
          // l'onglet, pour que le lien de l'email « document disponible » y mène.
          // Ne suit PAS reg.readOnly : ce flag vaut true dès la soumission (SUBMITTED, WAITLISTED).
          return (
            reg.status === RegistrationStatus.ACCEPTED ||
            reg.status === RegistrationStatus.CONFIRMED ||
            reg.status === RegistrationStatus.COMPLETED ||
            reg.documents.some((doc) => doc.kind !== 'quote' && doc.kind !== 'insurance')
          );
        case RegistrationStep.PAYMENT:
          // Débloquée seulement après signature effective du devis (webhook Docuseal), pas dès la
          // simple confirmation — cf. spec 2026-08-12-docuseal-webhook-signature-design.md §7.2.
          // N'utilise PAS reg.readOnly (même piège documenté ci-dessus pour DOCUMENTS) : ce flag vaut
          // déjà true dès que le statut quitte DRAFT sur une édition active, ce qui débloquerait
          // Paiement bien avant toute signature si on le gardait dans cette condition.
          return (
            reg.status === RegistrationStatus.COMPLETED ||
            reg.documents.some((doc) => doc.kind === 'quote' && doc.signatureStatus === 'signed')
          );
        default:
          return false;
      }
    };
  });

  /** Calculé côté serveur, source de vérité (cf. Registration::computeOptionsTotal() côté back). */
  readonly standTotalTtc = computed(() => this.state()?.stand.totalTtc ?? 0);

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
    const discounted = reg.payment.standTotalTtc * (1 - reg.payment.discountPercent / 100);
    const extras = reg.payment.extraOptions.reduce((sum, extra) => sum + extra.lineTotalTtc, 0);
    // Les prestations s'ajoutent APRÈS la remise, comme dans Registration::getOrderTotalTtc().
    const orderTotal = discounted + reg.payment.fileFeeTtc + reg.payment.additionalFeeTtc + extras;

    return orderTotal - this.paymentsTotalTtc();
  });

  /**
   * Sections marquées obligatoires en administration dont aucune option n'est retenue.
   * Remplace l'ancien `Validators.required` codé en dur sur la surface.
   */
  readonly missingRequiredGroups = computed<OptionGroupDefinition[]>(() => {
    const selections = this.state()?.stand.selections ?? {};

    return this.optionGroups().filter(
      (group) => group.isRequired && !group.options.some((option) => (selections[option.id] ?? 0) > 0),
    );
  });

  /**
   * Charge l'inscription réelle pour l'année donnée (get-or-create côté back). Asynchrone :
   * `loading`/`loadError` reflètent l'état de la requête, `registration()` reste `null` tant
   * qu'elle n'a pas abouti.
   */
  loadForEditionYear(
    year: string,
    paymentReturnStatus: 'success' | 'cancelled' | null = null,
    requestedStep: RegistrationStep | null = null,
  ): void {
    // Capturé synchronement AVANT que le composant appelant ne retire `?payment=...` de l'URL
    // (cf. EditionFormPageComponent.ngOnInit, qui nettoie l'URL juste après cet appel) : si on
    // lisait `this.router.url` plus tard, dans le catchError 401 ci-dessous, le paramètre aurait
    // déjà disparu et ne survivrait pas au détour par le login.
    const currentUrlForReturn = this.router.url;
    this.loadingSignal.set(true);
    this.loadErrorSignal.set(null);
    this.state.set(null);
    this.activeStepSignal.set(RegistrationStep.ENTITY);
    // Le retour de Stripe prime sur un éventuel `?step=` : c'est l'onglet Paiement qui affiche le solde.
    this.pendingStep = paymentReturnStatus ? RegistrationStep.PAYMENT : requestedStep;
    this.entityAutosaveStatusSignal.set('idle');
    this.standAutosaveStatusSignal.set('idle');
    this.sharedDocumentsSignal.set([]);
    this.catalogLoadFailedSignal.set(false);
    // État d'envoi du stand lié à l'inscription précédente : sans cela, un spinner ou une
    // sauvegarde en attente survivraient au changement d'édition.
    this.standSaveWaiters = [];
    this.standResendQueued = false;
    this.structureUploadingSignal.set(false);
    this.structureUploadErrorsSignal.set([]);
    this.structureRemovingIdsSignal.set(new Set());

    // Le cache du catalogue ne connaît pas le type d'exposant : un catalogue mis en cache avant un
    // changement de type (autre visite, autre compte) proposerait les packs de surface de l'autre type.
    this.catalogExhibitorType = null;
    this.optionsCatalogService.invalidate(year);
    this.optionsCatalogService.getForEdition(year).subscribe({
      next: (groups) => {
        this.optionGroupsSignal.set(groups);
        this.catalogLoadFailedSignal.set(false);
      },
      error: () => {
        this.optionGroupsSignal.set([]);
        this.catalogLoadFailedSignal.set(true);
      },
    });

    this.documentService.getSharedDocuments(year).subscribe({
      next: (response) =>
        this.sharedDocumentsSignal.set(
          response.data.map((doc) => ({ ...doc, fileUrl: doc.fileUrl ? toAbsoluteUrl(doc.fileUrl) : null })),
        ),
      error: (err) => console.warn('[EditionFormStateService] Échec du chargement des documents communs :', err),
    });

    this.registrationService
      .getByEditionYear(year)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          if (err.status === 401) {
            // Session expirée pendant l'aller-retour Stripe (les sessions Checkout peuvent vivre
            // jusqu'à 24h) : ne PAS afficher "Aucune inscription trouvée", rediriger vers le login
            // en conservant l'URL courante (dont ?payment=success/cancelled) pour y revenir après
            // connexion — cf. revue finale §Important. Même `?returnUrl=` que celui posé par
            // authGuard, consommé par LoginComponent.
            void this.router.navigate(['/login'], { queryParams: { returnUrl: currentUrlForReturn } });
            return of(null);
          }
          this.loadErrorSignal.set(err.status === 403 ? 'closed' : 'not_found');
          this.pendingStep = null;
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
        this.catalogExhibitorType = this.state()?.entity.exhibitorType ?? null;

        // Étape déjà accessible avec la seule réponse principale (Entité, Stand, ou statut suffisant) :
        // on l'ouvre tout de suite. Sinon elle reste en attente des documents réels (cf. pendingStep).
        if (this.pendingStep !== null && this.isStepUnlocked()(this.pendingStep)) {
          this.goToStep(this.pendingStep);
        }

        if (paymentReturnStatus) {
          this.messageService.add(
            paymentReturnStatus === 'success'
              ? {
                  severity: 'success',
                  summary: 'Paiement en cours de confirmation',
                  detail: 'Votre règlement a bien été transmis à Stripe. Le solde sera mis à jour dès sa confirmation.',
                }
              : {
                  severity: 'warn',
                  summary: 'Paiement annulé',
                  detail: 'Vous avez annulé le paiement. Vous pouvez réessayer à tout moment.',
                },
          );
        }
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
          this.pendingStep = null;
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
          next: (docsResponse) => this.mergeRealDocuments(docsResponse.data),
          error: (err) => {
            console.warn('[EditionFormStateService] Échec du chargement des documents réels :', err);
            this.pendingStep = null;
          },
        });
      },
      error: (err) => {
        console.warn('[EditionFormStateService] Échec du chargement de la registration réelle :', err);
        this.pendingStep = null;
      },
    });
  }

  /**
   * Remplace la liste des documents de l'état par celle renvoyée par l'API.
   *
   * Aucun filtre de type : l'état local ne porte plus de documents mockés (`documents: []` à
   * l'initialisation), la réponse de l'API est donc la seule source. Filtrer sur 'quote' — ce que
   * faisait la version précédente — jetait silencieusement factures, e-billets, documents libres et
   * assurance RC.
   */
  private mergeRealDocuments(documents: DocumentSummary[]): void {
    const items: DocumentItem[] = documents.map((doc) => ({
      id: doc.id,
      kind: doc.type,
      label: doc.label,
      visible: true,
      fileUrl: doc.fileUrl ? toAbsoluteUrl(doc.fileUrl) : null,
      signingUrl: doc.signingUrl,
      signatureStatus: doc.signatureStatus,
      uploadedAt: new Date(doc.uploadedAt),
    }));

    this.state.update((reg) => (reg ? { ...reg, documents: items } : reg));

    if (this.pendingStep !== null) {
      // goToStep() est sans effet si l'étape reste verrouillée : on garde alors l'étape par défaut.
      this.goToStep(this.pendingStep);
    }
  }

  goToStep(step: RegistrationStep): void {
    // Toute navigation (clic dans le stepper, Suivant/Précédent, passage auto aux Documents après
    // confirmation) remplace l'étape demandée à l'ouverture : un chargement tardif des documents ne
    // doit pas ramener l'exposant sur l'onglet du lien d'email.
    this.pendingStep = null;
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

  /** Le bouton "Suivant" ne doit être actionnable que si l'étape suivante est réellement atteignable. */
  readonly isNextStepUnlocked = computed(() => {
    const next = this.stepOrder[this.stepOrder.indexOf(this.activeStepSignal()) + 1];
    return next !== undefined && this.isStepUnlocked()(next);
  });

  /**
   * Bouton de droite du pied de formulaire sur l'étape Stand, selon l'avancement de la demande :
   * - `submit` : brouillon encore modifiable, le bouton s'appelle « Soumettre » et envoie la demande ;
   * - `hidden` : demande envoyée, en attente de décision de HA (ou en liste d'attente) — un
   *   « Suivant » forcément grisé ne ferait que dérouter l'exposant ;
   * - `next` : décision rendue (acceptée, refusée, puis confirmée…) ou brouillon d'une édition close
   *   consulté en lecture seule, le bouton redevient « Suivant ».
   * Sur les autres étapes, toujours `next`.
   */
  readonly nextButtonMode = computed((): 'submit' | 'hidden' | 'next' => {
    const reg = this.state();
    if (!reg || this.activeStepSignal() !== RegistrationStep.STAND) {
      return 'next';
    }
    if (reg.status === RegistrationStatus.DRAFT) {
      return reg.readOnly ? 'next' : 'submit';
    }
    if (reg.status === RegistrationStatus.SUBMITTED || reg.status === RegistrationStatus.WAITLISTED) {
      return 'hidden';
    }
    return 'next';
  });

  /** Symétrique pour "Précédent" — protège contre le même dead-click si une étape antérieure se reverrouillait. */
  readonly isPreviousStepUnlocked = computed(() => {
    const previous = this.stepOrder[this.stepOrder.indexOf(this.activeStepSignal()) - 1];
    return previous !== undefined && this.isStepUnlocked()(previous);
  });

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

  /**
   * Choix unique dans une section : retire toutes les options de la section avant de poser la
   * nouvelle. `optionId` à `null` vide la section.
   */
  selectSingleOption(group: OptionGroupDefinition, optionId: string | null): void {
    this.patchLocalState((reg) => {
      const selections = { ...reg.stand.selections };
      for (const option of group.options) {
        delete selections[option.id];
      }
      if (optionId !== null) {
        selections[optionId] = 1;
      }

      return { stand: { ...reg.stand, selections } };
    });
    this.scheduleStandAutosave();
  }

  /** Coche ou décoche une option. La quantité facturée reste décidée par le serveur. */
  toggleOption(optionId: string, selected: boolean): void {
    this.patchLocalState((reg) => {
      const selections = { ...reg.stand.selections };
      if (selected) {
        selections[optionId] = 1;
      } else {
        delete selections[optionId];
      }

      return { stand: { ...reg.stand, selections } };
    });
    this.scheduleStandAutosave();
  }

  /** Quantité saisie par l'exposant. Zéro équivaut à ne pas commander l'option. */
  setOptionQuantity(optionId: string, quantity: number): void {
    this.patchLocalState((reg) => {
      const selections = { ...reg.stand.selections };
      const safeQuantity = Math.max(0, quantity);
      if (safeQuantity > 0) {
        selections[optionId] = safeQuantity;
      } else {
        delete selections[optionId];
      }

      return { stand: { ...reg.stand, selections } };
    });
    this.scheduleStandAutosave();
  }

  setPartitionDetail(partition: PartitionDetailForm | null): void {
    this.patchLocalState((reg) => ({ stand: { ...reg.stand, partition } }));
    this.scheduleStandAutosave();
  }

  /** Commentaire libre de l'exposant sur sa demande, envoyé avec le reste de l'étape Stand. */
  setStandComment(comment: string): void {
    this.patchLocalState((reg) => ({ stand: { ...reg.stand, comment: comment.trim() === '' ? null : comment } }));
    this.scheduleStandAutosave();
  }

  setStructureCharacteristics(characteristics: string): void {
    this.patchLocalState((reg) => ({
      stand: {
        ...reg.stand,
        structure: {
          characteristics: characteristics.trim() === '' ? null : characteristics,
          attachments: reg.stand.structure?.attachments ?? [],
        },
      },
    }));
    this.scheduleStandAutosave();
  }

  /**
   * Vide l'état local du barnum après décochage. Pas d'autosave ici : le décochage en a déjà
   * programmé un, et c'est le serveur qui supprime détail et fichiers avec la ligne.
   */
  clearStructureDetail(): void {
    this.patchLocalState((reg) => ({ stand: { ...reg.stand, structure: null } }));
    this.structureUploadErrorsSignal.set([]);
  }

  /**
   * Signale les fichiers refusés par le sélecteur (format hors liste) : remplace la liste d'erreurs
   * de la sélection en cours, avant que uploadStructureAttachments() n'y ajoute les siennes.
   */
  reportRejectedStructureFiles(names: string[]): void {
    this.structureUploadErrorsSignal.set(names.map((name) => `${name} : formats acceptés : JPG, PNG, WebP, PDF.`));
  }

  isRemovingStructureAttachment(attachmentId: string): boolean {
    return this.structureRemovingIdsSignal().has(attachmentId);
  }

  uploadStructureAttachments(allFiles: File[]): void {
    const reg = this.state();
    if (!reg || this.isReadOnly() || allFiles.length === 0 || this.structureUploadingSignal()) {
      return;
    }
    // Les erreurs de format de la même sélection (reportRejectedStructureFiles) sont déjà dans le
    // signal : on y ajoute, on ne les écrase pas.
    if (!this.isStandPayloadSendable(reg.stand)) {
      this.structureUploadErrorsSignal.update((errors) => [
        ...errors,
        "Complétez d'abord le détail de vos cloisons : vos options de stand ne sont pas encore enregistrées.",
      ]);

      return;
    }

    const oversized = allFiles.filter((file) => file.size > STRUCTURE_MAX_FILE_SIZE_BYTES);
    const files = allFiles.filter((file) => file.size <= STRUCTURE_MAX_FILE_SIZE_BYTES);

    const remaining = Math.max(0, STRUCTURE_MAX_ATTACHMENTS - (reg.stand.structure?.attachments.length ?? 0));
    const accepted = files.slice(0, remaining);
    this.structureUploadErrorsSignal.update((errors) => [
      ...errors,
      ...oversized.map((file) => `${file.name} : 10 Mo maximum.`),
      ...files.slice(remaining).map((file) => `${file.name} : ${STRUCTURE_MAX_ATTACHMENTS} fichiers maximum.`),
    ]);
    if (accepted.length === 0) {
      return;
    }

    this.structureUploadingSignal.set(true);
    this.whenStandSaved(
      () => this.uploadStructureFilesSequentially(reg.id, accepted),
      () => {
        this.structureUploadingSignal.set(false);
        this.structureUploadErrorsSignal.update((errors) => [
          ...errors,
          "Vos options de stand n'ont pas pu être enregistrées : réessayez l'envoi.",
        ]);
      },
    );
  }

  removeStructureAttachment(attachmentId: string): void {
    const reg = this.state();
    if (!reg || this.isReadOnly() || this.structureRemovingIdsSignal().has(attachmentId)) {
      return;
    }

    const registrationId = reg.id;
    const setRemoving = (removing: boolean): void =>
      this.structureRemovingIdsSignal.update((ids) => {
        const next = new Set(ids);
        if (removing) {
          next.add(attachmentId);
        } else {
          next.delete(attachmentId);
        }

        return next;
      });
    setRemoving(true);
    this.registrationService.deleteStructureAttachment(registrationId, attachmentId).subscribe({
      next: () => {
        setRemoving(false);
        this.state.update((current) => {
          const structure = current?.stand.structure;
          if (!current || current.id !== registrationId || !structure) {
            return current;
          }

          return {
            ...current,
            stand: {
              ...current.stand,
              structure: { ...structure, attachments: structure.attachments.filter((a) => a.id !== attachmentId) },
            },
          };
        });
      },
      error: (err: HttpErrorResponse) => {
        setRemoving(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Échec',
          detail: typeof err.error?.message === 'string' ? err.error.message : "Le fichier n'a pas pu être retiré.",
        });
      },
    });
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
    if (!reg || this.missingRequiredGroups().length > 0) {
      return;
    }

    // Une sauvegarde de l'étape Stand encore en attente (debounce) est envoyée avant la
    // soumission : sans cela, un commentaire tapé juste avant « Envoyer ma demande » partirait
    // après la soumission, voire jamais. En cas d'échec, le toast de saveStandNow() s'affiche et
    // la soumission n'a pas lieu.
    if (this.standAutosaveTimer) {
      clearTimeout(this.standAutosaveTimer);
      this.standAutosaveTimer = null;
      this.saveStandNow(() => this.submitRegistrationOptions());

      return;
    }

    this.submitStatusSignal.set('submitting');
    this.registrationService.submit(reg.id).subscribe({
      next: (response) => {
        this.state.update((current) =>
          current
            ? { ...current, status: response.data.status as RegistrationStatus, readOnly: true }
            : current,
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

  /**
   * Crée une session Stripe Checkout pour le montant actuellement recommandé (ou fixé par l'admin,
   * cf. Registration::getNextCardPaymentAmountTtc côté back) et redirige l'exposant vers Stripe. Le
   * solde n'est jamais mis à jour ici : c'est le webhook Stripe (côté back) qui fait foi, cf.
   * loadForEditionYear() qui recharge l'état réel au retour de paiement.
   */
  startCardPayment(): void {
    const reg = this.state();
    if (!reg || this.checkoutInProgressSignal()) {
      return;
    }

    this.checkoutInProgressSignal.set(true);
    this.registrationService.createPaymentCheckoutSession(reg.id).subscribe({
      next: (response) => {
        if (!response.data?.url) {
          this.handleCheckoutSessionError();
          return;
        }
        window.location.href = response.data.url;
      },
      error: (err: HttpErrorResponse) => this.handleCheckoutSessionError(err),
    });
  }

  /**
   * Gère à la fois l'échec réseau/serveur de createPaymentCheckoutSession() et le cas d'une
   * réponse 2xx sans `url` exploitable (backend inattendu) : mêmes toast et remise à zéro du
   * signal de chargement dans les deux cas, pour ne jamais laisser `window.location.href`
   * naviguer vers "undefined".
   */
  private handleCheckoutSessionError(err?: HttpErrorResponse): void {
    this.checkoutInProgressSignal.set(false);
    const errors = (err?.error?.errors ?? {}) as Record<string, string[]>;
    const detail =
      Object.values(errors).flat().join(' ') ||
      err?.error?.message ||
      "Le paiement par carte n'a pas pu être initié. Réessayez dans quelques instants.";
    this.messageService.add({ severity: 'error', summary: 'Paiement indisponible', detail });
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
            next: (docsResponse) => this.mergeRealDocuments(docsResponse.data),
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
      next: (response) => this.mergeRealDocuments(response.data),
      error: (err) => console.warn('[EditionFormStateService] Échec du rafraîchissement des documents :', err),
    });
  }

  /**
   * Téléverse ou remplace l'assurance RC. Le back renvoie le document à jour, qu'on fusionne dans
   * l'état sans recharger toute la liste.
   *
   * La garde est `isEditionClosed()` et non `isReadOnly()` : ce dernier passe à true dès que le
   * statut quitte DRAFT, ce qui interdirait le téléversement précisément à partir de l'étape
   * Documents, qui suppose une inscription confirmée.
   */
  uploadInsuranceDocument(file: File): void {
    const reg = this.state();
    if (!reg || this.isEditionClosed()) {
      return;
    }

    this.documentService.uploadInsurance(reg.id, file).subscribe({
      next: () => {
        // Le serveur est la seule autorité sur `state.documents` : on recharge la liste complète
        // plutôt que d'y injecter l'entrée manuellement, pour ne jamais perdre à une réponse GET
        // concurrente (déclenchée par le retour de focus fenêtre, cf. revue finale — défaut n°3).
        this.refreshDocuments();
        this.messageService.add({
          severity: 'success',
          summary: 'Assurance RC enregistrée',
          detail: 'Votre attestation a bien été enregistrée.',
        });
      },
      error: (err: HttpErrorResponse) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Échec',
          detail: typeof err.error?.message === 'string'
            ? err.error.message
            : "Votre assurance n'a pas pu être enregistrée.",
        });
      },
    });
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
        standName: reg.entity.standName,
        activityDomainIds: reg.entity.activityDomainIds,
        clubType: reg.entity.clubType,
        entityManager: reg.entity.entityManager,
        previousEditions: reg.entity.previousEditions,
      };
      this.registrationService.patchEntity(reg.id, payload).subscribe({
        next: (response) => {
          this.state.update((current) =>
            current ? { ...current, entity: this.toEntityStepState(response.data) } : current,
          );
          this.entityAutosaveStatusSignal.set('saved');
          if (response.data.exhibitorType !== this.catalogExhibitorType) {
            this.reloadCatalogForExhibitorType(reg.editionYear, response.data.exhibitorType);
          }
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

  /**
   * Après un changement de type d'exposant : recharge le catalogue (les packs de surface Pro et
   * Club sont des options distinctes), retire des sélections les options qui n'y figurent plus
   * (le serveur a déjà retiré la ligne correspondante), puis renvoie le stand pour que lignes et
   * totaux soient recalculés aux tarifs du nouveau type.
   */
  private reloadCatalogForExhibitorType(year: string, exhibitorType: string): void {
    this.catalogExhibitorType = exhibitorType;
    this.optionsCatalogService.invalidate(year);
    this.optionsCatalogService.getForEdition(year).subscribe({
      next: (groups) => {
        if (this.catalogExhibitorType !== exhibitorType) {
          return; // un autre changement de type a suivi : sa propre réponse fait foi
        }
        this.optionGroupsSignal.set(groups);
        this.catalogLoadFailedSignal.set(false);

        const knownIds = new Set(groups.flatMap((group) => group.options.map((option) => option.id)));
        this.patchLocalState((reg) => ({
          stand: {
            ...reg.stand,
            selections: Object.fromEntries(
              Object.entries(reg.stand.selections).filter(([optionId]) => knownIds.has(optionId)),
            ),
          },
        }));
        this.scheduleStandAutosave();
      },
      error: () => {
        this.optionGroupsSignal.set([]);
        this.catalogLoadFailedSignal.set(true);
      },
    });
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
      this.standAutosaveTimer = null;
      this.saveStandNow();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  /**
   * Force l'envoi immédiat d'une sauvegarde de stand en attente (debounce en cours), sans attendre
   * le délai d'autosave. Sans effet en lecture seule.
   */
  flushStandSave(): void {
    if (this.isReadOnly()) {
      return;
    }
    if (this.standAutosaveTimer) {
      clearTimeout(this.standAutosaveTimer);
      this.standAutosaveTimer = null;
    }
    this.saveStandNow();
  }

  /**
   * Envoie immédiatement l'état local de l'étape Stand. `onSaved` n'est appelé qu'en cas de
   * succès (utilisé par submitRegistrationOptions() pour soumettre après la dernière sauvegarde).
   * Retourne `true` si une requête a été envoyée.
   */
  private saveStandNow(onSaved?: () => void, isResend = false): boolean {
    const reg = this.state();
    if (!reg) {
      if (isResend) {
        this.settleStandSaveWaiters(false, (waiter) => waiter.requiredSeq > this.standSavedSeq);
      }

      return false;
    }
    // Tant que le bloc cloison est incomplet, on n'envoie rien : le serveur rejette en 400 une
    // disposition sans longueurs, et une saisie en cours n'a pas à faire remonter une erreur à
    // l'exposant. La sauvegarde repart d'elle-même à la modification suivante.
    if (!this.isStandPayloadSendable(reg.stand)) {
      this.standAutosaveStatusSignal.set('pending');
      if (isResend) {
        this.settleStandSaveWaiters(false, (waiter) => waiter.requiredSeq > this.standSavedSeq);
      }

      return false;
    }

    const payload: StandStepPayload = {
      selections: reg.stand.selections,
      partition: reg.stand.partition,
      structure: reg.stand.structure ? { characteristics: reg.stand.structure.characteristics } : null,
      comment: reg.stand.comment,
    };
    const seq = ++this.standSaveSeq;
    this.standSavesInFlight++;
    this.registrationService.patchStand(reg.id, payload).subscribe({
      next: (response) => {
        this.standSavesInFlight--;
        this.standSavedSeq = Math.max(this.standSavedSeq, seq);
        // On ne remplace QUE les champs dérivés côté serveur (lignes/totaux) : `selections`,
        // `partition` et `structure` restent sous contrôle local, car l'exposant peut avoir continué
        // à modifier ces champs pendant l'aller-retour réseau (debounce + latence) — un écho serveur
        // qui remplacerait tout écraserait silencieusement une saisie en cours (cf. revue finale).
        this.state.update((current) => {
          if (!current) {
            return current;
          }
          const dto = this.toStandStepState(response.data);

          return {
            ...current,
            stand: {
              ...current.stand,
              lines: dto.lines,
              totalTtc: dto.totalTtc,
              totalVat: dto.totalVat,
              depositTtc: dto.depositTtc,
            },
          };
        });
        // Un renvoi est en attente : on reste en « saving » jusqu'à son résultat.
        if (!this.standResendQueued) {
          this.standAutosaveStatusSignal.set('saved');
        }
        onSaved?.();
        this.settleStandSaveWaiters(true, (waiter) => waiter.requiredSeq <= this.standSavedSeq);
        this.runQueuedStandResend();
      },
      error: () => {
        this.standSavesInFlight--;
        if (!this.standResendQueued) {
          this.standAutosaveStatusSignal.set('error');
        }
        this.messageService.add({
          severity: 'error',
          summary: 'Échec de la sauvegarde',
          detail: "Vos options de stand n'ont pas pu être enregistrées. Nouvel essai à la prochaine modification.",
        });
        this.settleStandSaveWaiters(false, (waiter) => waiter.requiredSeq <= seq);
        this.runQueuedStandResend();
      },
    });

    return true;
  }

  /** Envoie l'état local plus récent mis en attente par whenStandSaved(), une fois le vol terminé. */
  private runQueuedStandResend(): void {
    if (this.standSavesInFlight > 0 || !this.standResendQueued) {
      return;
    }
    this.standResendQueued = false;
    // Non envoyable : saveStandNow() fait lui-même échouer les waiters concernés.
    this.saveStandNow(undefined, true);
  }

  /**
   * Exécute `done` une fois l'étape Stand persistée côté serveur, état local courant compris.
   * Nécessaire avant tout envoi de fichier barnum : la ligne d'option n'existe côté serveur qu'après
   * l'autosave, et l'exposant peut choisir ses fichiers dans les 800 ms qui suivent la coche.
   */
  private whenStandSaved(done: () => void, failed: () => void): void {
    const status = this.standAutosaveStatusSignal();
    const hasUnsentChanges = this.standAutosaveTimer !== null || status === 'pending' || status === 'error';
    if (this.standAutosaveTimer) {
      clearTimeout(this.standAutosaveTimer);
      this.standAutosaveTimer = null;
    }
    if (hasUnsentChanges) {
      if (this.standSavesInFlight === 0) {
        if (!this.saveStandNow()) {
          failed();

          return;
        }
        this.standSaveWaiters.push({ requiredSeq: this.standSaveSeq, done, failed });
      } else {
        // Une requête est en vol avec un état plus ancien : on en enverra une seconde derrière elle.
        this.standResendQueued = true;
        this.standAutosaveStatusSignal.set('saving');
        this.standSaveWaiters.push({ requiredSeq: this.standSaveSeq + 1, done, failed });
      }

      return;
    }
    if (this.standSavesInFlight > 0) {
      // La dernière requête envoyée porte déjà l'état courant.
      this.standSaveWaiters.push({ requiredSeq: this.standSaveSeq, done, failed });

      return;
    }
    done();
  }

  private settleStandSaveWaiters(saved: boolean, matches: (waiter: { requiredSeq: number }) => boolean): void {
    const settled = this.standSaveWaiters.filter(matches);
    this.standSaveWaiters = this.standSaveWaiters.filter((waiter) => !matches(waiter));
    settled.forEach((waiter) => (saved ? waiter.done() : waiter.failed()));
  }

  /** Un fichier à la fois : un refus (format, taille) n'empêche pas l'envoi des suivants. */
  private uploadStructureFilesSequentially(registrationId: string, files: File[]): void {
    from(files)
      .pipe(
        concatMap((file) =>
          this.registrationService.uploadStructureAttachment(registrationId, file).pipe(
            map((response) => ({ file, attachment: this.toStructureAttachment(response.data), error: null as string | null })),
            catchError((err: HttpErrorResponse) =>
              of({
                file,
                attachment: null,
                error: typeof err.error?.message === 'string' ? err.error.message : "envoi impossible.",
              }),
            ),
          ),
        ),
      )
      .subscribe({
        next: ({ file, attachment, error }) => {
          if (attachment === null) {
            this.structureUploadErrorsSignal.update((errors) => [...errors, `${file.name} : ${error}`]);

            return;
          }
          this.state.update((current) =>
            current && current.id === registrationId && (current.stand.structure !== null || this.isStructureSelected(current.stand))
              ? {
                  ...current,
                  stand: {
                    ...current.stand,
                    structure: {
                      characteristics: current.stand.structure?.characteristics ?? null,
                      attachments: [...(current.stand.structure?.attachments ?? []), attachment],
                    },
                  },
                }
              : current,
          );
        },
        complete: () => this.structureUploadingSignal.set(false),
      });
  }

  /** Vrai si une option d'un groupe barnum / structure est cochée dans l'état local. */
  private isStructureSelected(stand: StandStepState): boolean {
    return this.optionGroups()
      .filter((group) => group.behaviour === OptionGroupBehaviour.STRUCTURE)
      .some((group) => group.options.some((option) => (stand.selections[option.id] ?? 0) > 0));
  }

  private toStructureAttachment(dto: StructureAttachmentApiDto): StructureAttachment {
    return {
      id: dto.id,
      originalName: dto.originalName,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
      url: dto.url ? toAbsoluteUrl(dto.url) : '',
      createdAt: new Date(dto.createdAt),
    };
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
      editionClosed: dto.editionClosed,
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
        additionalFeeLabel: dto.payment.additionalFeeLabel,
        additionalFeeTtc: dto.payment.additionalFeeTtc,
        depositRatePercent: dto.payment.depositRatePercent,
        extraOptions: (dto.payment.extraOptions ?? []).map((e) => ({
          id: e.id,
          label: e.label,
          quantity: e.quantity,
          unitPriceTtc: e.unitPriceTtc,
          lineTotalTtc: e.lineTotalTtc,
        })),
        balanceDueDate: dto.payment.balanceDueDate ? new Date(dto.payment.balanceDueDate) : null,
        bankIban: dto.payment.bankIban,
        bankBic: dto.payment.bankBic,
        nextCardPaymentAmountTtc: dto.payment.nextCardPaymentAmountTtc,
        payments: dto.payment.payments.map((p) => ({
          id: p.id,
          amountTtc: p.amountTtc,
          method: p.method,
          paidAt: new Date(p.paidAt),
          label: p.label,
        })),
      },
    };
  }

  private toEntityStepState(dto: EntityStepApiDto): EntityStepState {
    return {
      exhibitorType: dto.exhibitorType as EditionRegistrationState['entity']['exhibitorType'],
      companyName: dto.companyName,
      siret: dto.siret,
      standName: dto.standName ?? null,
      activityDomainIds: dto.activityDomainIds ?? [],
      clubType: dto.clubType as EditionRegistrationState['entity']['clubType'],
      visualUrl: dto.visualUrl ? toAbsoluteUrl(dto.visualUrl) : null,
      entityManager: {
        firstName: dto.entityManager?.firstName ?? '',
        lastName: dto.entityManager?.lastName ?? '',
        phone: dto.entityManager?.phone ?? '',
        email: dto.entityManager?.email ?? '',
      },
      previousEditions: dto.previousEditions ?? null,
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
      selections: dto.selections,
      partition: dto.partition as StandStepState['partition'],
      structure: dto.structure
        ? {
            characteristics: dto.structure.characteristics,
            attachments: dto.structure.attachments.map((attachment) => this.toStructureAttachment(attachment)),
          }
        : null,
      lines: dto.lines as StandStepState['lines'],
      totalTtc: dto.totalTtc,
      totalVat: dto.totalVat,
      depositTtc: dto.depositTtc,
      comment: dto.comment ?? null,
    };
  }

  /** Miroir de la validation serveur du bloc cloison (RegistrationStandStepController). */
  private isStandPayloadSendable(stand: StandStepState): boolean {
    const partitionGroup = this.optionGroups().find(
      (group) => group.behaviour === OptionGroupBehaviour.PARTITION,
    );
    const partitionSelected =
      partitionGroup?.options.some((option) => (stand.selections[option.id] ?? 0) > 0) ?? false;

    if (!partitionSelected) {
      return true;
    }

    const detail = stand.partition;

    return (
      detail !== null &&
      detail.segments.length === PARTITION_SEGMENT_COUNTS[detail.layout] &&
      detail.segments.every((length) => length > 0)
    );
  }

  private patchLocalState(producer: (reg: EditionRegistrationState) => Partial<EditionRegistrationState>): void {
    if (this.isReadOnly()) {
      return;
    }
    this.state.update((reg) => (reg ? { ...reg, ...producer(reg) } : reg));
  }
}
