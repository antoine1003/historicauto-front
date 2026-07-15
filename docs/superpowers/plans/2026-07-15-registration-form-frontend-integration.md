# Registration Form Frontend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the Angular exhibitor registration form's Étapes 1 (Entité) and 2 (Stand) to the real
Symfony backend API, replacing `options-catalog.ts` and `mock-registrations.ts` with real HTTP calls,
while leaving Étapes 3-5 (Confirmation, Documents, Paiement) as-is (front-only, reading placeholder
data now sourced from the real API response instead of a mock).

**Architecture:** Thin HTTP-wrapper services (`OptionsCatalogService`, `ActivityDomainService`,
extended `RegistrationService`) feed a route-scoped `EditionFormStateService` that owns all signal
state and orchestration (two independent debounced autosave pipelines — Entité and Stand — plus
immediate CRUD for stand managers, logo upload, and submit). Step components stay thin, reading
signals and calling state-service methods exactly as they do today; their public surface barely
changes. A new global `MessageService`/`<p-toast>` surfaces network errors.

**Tech Stack:** Angular 21 (standalone components, signals), PrimeNG (Aura preset), RxJS, existing
`HttpClient` + `authInterceptor` (JWT). Backend contract: `historicauto-back`, branch
`worktree-registration-form-backend-api` (see
`docs/superpowers/specs/2026-07-15-registration-form-frontend-integration-design.md` §3 for the full
route table — copied verbatim from the real, reviewed backend DTOs, not guessed).

## Global Constraints

- **No automated tests in this plan** (explicit user decision, mirroring the backend plan's Tasks
  6-12) — every task is implemented directly, verified via `npm run build` (type-check) for
  foundational/non-UI tasks and manual browser verification for UI-wiring tasks, with a final
  full-flow manual verification task (Task 15) against the real local backend.
- New HTTP-wrapper services do **not** extend `AbstractRestService<T extends BaseEntity>` — its
  `BaseEntity.id: number` is incompatible with this API's UUID string ids. Follow the plain
  `HttpClient` + `Observable<ApiResponse<T>>` pattern already used by `RegistrationService.getMine()`
  and `EditionService.getActive()`.
- Every new HTTP call goes through the existing `authInterceptor` automatically (attaches the JWT
  Bearer token) — no manual auth header code.
- All user-facing strings (labels, Toast messages, error text) are French, matching every existing
  template.
- Backend contract is frozen: exact routes, DTO field names and casing come from
  `historicauto-back/src/DTO/Registration/*.php` and `historicauto-back/src/Controller/Api/*.php` on
  branch `worktree-registration-form-backend-api` — copied verbatim into this plan's code, not
  re-derived from the design spec prose alone.
- Local backend dev server for manual verification: run from
  `C:\Users\antoi\Documents\Programmation\AE\HistoricAuto\historicauto-back\.claude\worktrees\registration-form-backend-api`
  (already migrated, edition 2030 catalogue seeded) via `php -S 127.0.0.1:8000 -t public`, matching
  `environment.apiUrl: 'http://localhost:8000/api'` — no config change needed.
- Money fields from the API are already plain JS numbers (backend applies
  `JSON_PRESERVE_ZERO_FRACTION`) — display via the existing `number` pipe, no extra parsing.

---

## Task 1: Global Toast notification infrastructure

**Files:**
- Modify: `src/app/app.config.ts`
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`

**Interfaces:**
- Produces: `MessageService` (from `primeng/api`) injectable anywhere via DI (root-provided); a single
  `<p-toast>` mounted once in the app shell. Later tasks call
  `this.messageService.add({ severity, summary, detail })` to surface errors.
- Consumes: nothing new.

- [ ] **Step 1: Add `MessageService` to the root providers**

In `src/app/app.config.ts`, add the import and provider:

```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import Aura from '@primeuix/themes/aura';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { HistoricAutoPreset } from '@app/core/styles/historic-auto.preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    providePrimeNG({
      theme: {
        preset: HistoricAutoPreset,
        options: {
          darkModeSelector: false, // ← classe sur <html> au lieu de @media
        },
      }
    }),
    MessageService,
  ]
};
```

- [ ] **Step 2: Mount the Toast component in the app shell**

In `src/app/app.ts`, add `ToastModule` to the standalone component's imports:

```typescript
import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  authService = inject(AuthService);
  protected readonly title = signal('historicauto-front');
}
```

In `src/app/app.html`, add the toast container:

```html
<p-toast />
<router-outlet></router-outlet>
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: build succeeds with no errors.

Run: `npm start`, open `http://localhost:4200` in a browser.
Expected: page loads with no console errors; `document.querySelector('p-toast')` (or inspecting the
DOM) shows the toast container present (empty — no message has been pushed yet, that's expected).

- [ ] **Step 4: Commit**

```bash
git add src/app/app.config.ts src/app/app.ts src/app/app.html
git commit -m "feat: add global Toast notification infrastructure"
```

---

## Task 2: Registration API DTOs and updated internal models

**Files:**
- Create: `src/app/dashboard/models/registration-api.models.ts`
- Modify: `src/app/dashboard/models/edition-form.models.ts`
- Delete: `src/app/dashboard/services/options-catalog.ts`

**Interfaces:**
- Produces: `StandManagerApiDto`, `EntityStepApiDto`, `ConfirmationStepApiDto`, `PaymentStepApiDto`,
  `RegistrationDetailApiDto`, `OptionPriceApiDto`, `ActivityDomainApiDto` (raw wire shapes, field names
  copied verbatim from the backend DTOs). Updated `EditionRegistrationState` (adds `id: string`),
  updated `OptionDefinition` (real `priceTtc`/`vatRate`/`exhibitorType` replace the mock fields),
  renamed `EntityStepState.visualFileName` → `visualUrl: string | null`, renamed
  `EntityStepState.activityDomain` → `activityDomainId: string | null`. New payload types
  `EntityStepPayload`, `StandStepPayload`, `NewManagerPayload` for outgoing requests.
- Consumes: nothing (pure types, no runtime behavior).

**Why `options-catalog.ts` is deleted here, not later:** it exports a static array typed against the
*old* `OptionDefinition` shape (`mockPriceTtc`/`mockVatRate`). The moment this task changes
`OptionDefinition`, that file's literal array stops type-checking — and Angular's build type-checks
every file under `src/` whether or not anything imports it, so leaving it in place would fail the
build project-wide for the next six tasks for no benefit. Deleting it now, together with the type
change that invalidates it, is strictly simpler than carrying a broken unused file forward.

- [ ] **Step 1: Create the API DTO types**

Create `src/app/dashboard/models/registration-api.models.ts`:

```typescript
/**
 * Formes JSON exactes renvoyées par l'API Symfony (historicauto-back, branche
 * worktree-registration-form-backend-api). Copié depuis les DTO PHP
 * (src/DTO/Registration/*.php) — ne pas modifier sans vérifier le DTO correspondant côté back.
 */

export interface StandManagerApiDto {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
}

export interface EntityStepApiDto {
  exhibitorType: string;
  companyName: string;
  siret: string | null;
  activityDomainId: string | null;
  clubType: string | null;
  visualUrl: string | null;
  managers: StandManagerApiDto[];
}

export interface StandStepApiDto {
  selectedSurfaceOptionId: string | null;
  quantitiesByOptionId: Record<string, number>;
  standTotalTtc: number;
}

export interface ConfirmationStepApiDto {
  checklist: {
    acknowledgedQuoteAndPricing: boolean;
    acceptedGeneralTerms: boolean;
    noSublease: boolean;
    noStandSharing: boolean;
    cleanupCommitment: boolean;
    respectLayout: boolean;
    readAndApproved: boolean;
  };
  signatoryName: string;
  signatoryRole: string;
  confirmedAt: string | null;
}

export interface PaymentStepApiDto {
  standTotalTtc: number;
  discountPercent: number;
  fileFeeTtc: number;
  depositRatePercent: number;
  balanceDueDate: string | null;
  payments: unknown[];
}

export interface RegistrationDetailApiDto {
  id: string;
  editionYear: string;
  status: string;
  readOnly: boolean;
  entity: EntityStepApiDto;
  stand: StandStepApiDto;
  confirmation: ConfirmationStepApiDto;
  documents: unknown[];
  payment: PaymentStepApiDto;
}

export interface OptionPriceApiDto {
  optionId: string;
  category: string;
  label: string;
  unit: string | null;
  includedBadges: number | null;
  exhibitorType: string | null;
  priceTtc: number;
  vatRate: number;
}

export interface ActivityDomainApiDto {
  id: string;
  label: string;
}
```

- [ ] **Step 2: Update the internal models**

In `src/app/dashboard/models/edition-form.models.ts`, replace the entire file content with:

```typescript
/**
 * Miroir front des enums Symfony (App\Enum\ExhibitorType, ClubType, OptionCategory, RegistrationStatus).
 * Garder ces valeurs strictement synchronisées avec le back : elles sont envoyées telles quelles à l'API.
 */
export enum ExhibitorType {
  PRO = 'pro',
  CLUB = 'club',
}

export enum ClubType {
  BRAND_MODEL = 'brand_model',
  GENERALIST = 'generalist',
}

export enum OptionCategory {
  SURFACE = 'surface',
  CARPET = 'carpet',
  PARTITION = 'partition',
  STORAGE = 'storage',
  ELECTRICITY = 'electricity',
  LIGHTING = 'lighting',
  BARRIER = 'barrier',
  ACCESS = 'access',
  STRUCTURE = 'structure',
}

export const OPTION_CATEGORY_LABELS: Record<OptionCategory, string> = {
  [OptionCategory.SURFACE]: 'Surface',
  [OptionCategory.CARPET]: 'Moquette',
  [OptionCategory.PARTITION]: 'Cloison',
  [OptionCategory.STORAGE]: 'Réserve',
  [OptionCategory.ELECTRICITY]: 'Électricité',
  [OptionCategory.LIGHTING]: 'Éclairage',
  [OptionCategory.BARRIER]: 'Barriérage',
  [OptionCategory.ACCESS]: 'Accès',
  [OptionCategory.STRUCTURE]: 'Barnum / Structure',
};

export enum RegistrationStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  REFUSED = 'refused',
  WAITLISTED = 'waitlisted',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
}

/** Identifiant des 5 étapes, dans l'ordre d'affichage du stepper. */
export enum RegistrationStep {
  ENTITY = 1,
  STAND = 2,
  CONFIRMATION = 3,
  DOCUMENTS = 4,
  PAYMENT = 5,
}

export interface StandManagerForm {
  /** UUID serveur une fois créé côté back ; id temporaire `temp-<uuid>` pendant l'ajout optimiste. */
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface EntityStepState {
  exhibitorType: ExhibitorType;
  companyName: string;
  /** Uniquement pertinent si exhibitorType === PRO. */
  siret: string | null;
  /** Uniquement pertinent si exhibitorType === PRO. UUID d'ActivityDomain, résolu via ActivityDomainService. */
  activityDomainId: string | null;
  /** Uniquement pertinent si exhibitorType === CLUB. */
  clubType: ClubType | null;
  visualUrl: string | null;
  managers: StandManagerForm[];
}

/** Définition catalogue + tarif d'une option, source unique : GET /api/editions/{year}/option-prices. */
export interface OptionDefinition {
  id: string;
  category: OptionCategory;
  label: string;
  unit: string | null;
  /** Renseigné uniquement pour les packs de la catégorie SURFACE. */
  includedBadges: number | null;
  /** null = tarif commun Pro/Club (toutes catégories hors Surface). */
  exhibitorType: ExhibitorType | null;
  priceTtc: number;
  vatRate: number;
}

export interface StandStepState {
  /** Pack de surface unique sélectionné (un seul stand par inscription). */
  selectedSurfaceOptionId: string | null;
  /** Quantité par option pour toutes les catégories hors SURFACE (0 = non sélectionnée). */
  quantitiesByOptionId: Record<string, number>;
  /** Calculé côté serveur, source de vérité (cf. Registration::computeOptionsTotal()). */
  standTotalTtc: number;
}

export interface ConfirmationChecklistState {
  acknowledgedQuoteAndPricing: boolean;
  acceptedGeneralTerms: boolean;
  noSublease: boolean;
  noStandSharing: boolean;
  cleanupCommitment: boolean;
  respectLayout: boolean;
  readAndApproved: boolean;
}

export interface ConfirmationStepState {
  checklist: ConfirmationChecklistState;
  signatoryName: string;
  signatoryRole: string;
  /** Renseigné uniquement après confirmation effective (cf. RegistrationSignature côté back). */
  confirmedAt: Date | null;
}

export type DocumentKind = 'quote' | 'invoice' | 'insurance' | 'supplier_list' | 'ticket';

export interface DocumentItem {
  id: string;
  kind: DocumentKind;
  label: string;
  /** Un document n'est affiché à l'exposant que si HA l'a rendu visible dans le dashboard. */
  visible: boolean;
  fileUrl: string | null;
  signed: boolean;
  uploadedAt: Date | null;
}

export interface PaymentItem {
  id: string;
  amountTtc: number;
  method: string;
  paidAt: Date;
}

export interface PaymentSummary {
  standTotalTtc: number;
  discountPercent: number;
  fileFeeTtc: number;
  depositRatePercent: number;
  balanceDueDate: Date | null;
  payments: PaymentItem[];
}

/** État complet d'un formulaire d'inscription pour une édition donnée. */
export interface EditionRegistrationState {
  /** UUID de la Registration côté back — requis par tous les endpoints de mutation. */
  id: string;
  editionYear: string;
  status: RegistrationStatus;
  /** Une édition est verrouillée en lecture seule dès qu'elle n'est plus l'édition active d'inscription. */
  readOnly: boolean;
  entity: EntityStepState;
  stand: StandStepState;
  confirmation: ConfirmationStepState;
  documents: DocumentItem[];
  payment: PaymentSummary;
}

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ── Payloads envoyés à l'API ──

export interface EntityStepPayload {
  exhibitorType: ExhibitorType;
  companyName: string;
  siret: string | null;
  activityDomainId: string | null;
  clubType: ClubType | null;
}

export interface StandStepPayload {
  selectedSurfaceOptionId: string | null;
  quantitiesByOptionId: Record<string, number>;
}

export interface NewManagerPayload {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
}
```

- [ ] **Step 3: Delete the now-incompatible static catalogue**

```bash
rm src/app/dashboard/services/options-catalog.ts
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: build **fails** at this point, with errors in exactly these files (all fixed in later
tasks — confirm the error list matches this set, not something else):
- `src/app/dashboard/services/edition-form-state.service.ts` — imports the now-deleted
  `options-catalog.ts` and reads `.mockPriceTtc` (fixed in Task 6).
- `src/app/dashboard/services/mock-registrations.ts` — imports `EditionRegistrationState` and
  builds object literals missing the new `id` field (fixed/deleted in Task 6).
- `src/app/dashboard/page/edition-form/components/steps/entity/step-entity.component.ts`/`.html` —
  reference `visualFileName`/`activityDomain` (fixed in Task 12).
- `src/app/dashboard/page/edition-form/components/steps/stand/step-stand.component.ts`/`.html` —
  import the deleted `options-catalog.ts`, read `.mockPriceTtc` (fixed in Task 13).

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/models/registration-api.models.ts src/app/dashboard/models/edition-form.models.ts
git rm src/app/dashboard/services/options-catalog.ts
git commit -m "feat: add registration API DTO types, update internal models for real backend"
```

---

## Task 3: `OptionsCatalogService`

**Files:**
- Create: `src/app/dashboard/services/options-catalog.service.ts`

**Interfaces:**
- Produces: `OptionsCatalogService.getForEdition(year: string): Observable<OptionDefinition[]>`
  (`providedIn: 'root'`, cached per year — repeated calls for the same year return the same
  `Observable` without a new HTTP request).
- Consumes: `OptionPriceApiDto` (Task 2), `OptionDefinition`, `OptionCategory`, `ExhibitorType` (Task 2).

- [ ] **Step 1: Implement the service**

Create `src/app/dashboard/services/options-catalog.service.ts`:

```typescript
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '@app/core/models/api.models';
import { OptionPriceApiDto } from '../models/registration-api.models';
import { ExhibitorType, OptionCategory, OptionDefinition } from '../models/edition-form.models';

@Injectable({ providedIn: 'root' })
export class OptionsCatalogService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<OptionDefinition[]>>();

  /**
   * Récupère le catalogue d'options + tarifs pour une édition, mis en cache par année : plusieurs
   * appels successifs (ex: navigation entre étapes du même formulaire) ne déclenchent qu'une seule
   * requête réseau.
   */
  getForEdition(year: string): Observable<OptionDefinition[]> {
    let cached = this.cache.get(year);
    if (!cached) {
      cached = this.http
        .get<ApiResponse<OptionPriceApiDto[]>>(`${environment.apiUrl}/editions/${year}/option-prices`)
        .pipe(
          map((res) => res.data.map(toOptionDefinition)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
      this.cache.set(year, cached);
    }

    return cached;
  }
}

function toOptionDefinition(dto: OptionPriceApiDto): OptionDefinition {
  return {
    id: dto.optionId,
    category: dto.category as OptionCategory,
    label: dto.label,
    unit: dto.unit,
    includedBadges: dto.includedBadges,
    exhibitorType: dto.exhibitorType as ExhibitorType | null,
    priceTtc: dto.priceTtc,
    vatRate: dto.vatRate,
  };
}
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: no new errors introduced by this file (the pre-existing errors from Task 2's field renames
remain, unrelated to this file).

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/services/options-catalog.service.ts
git commit -m "feat: add OptionsCatalogService consuming the real option-prices endpoint"
```

---

## Task 4: `ActivityDomainService`

**Files:**
- Create: `src/app/dashboard/services/activity-domain.service.ts`

**Interfaces:**
- Produces: `ActivityDomainService.getAll(): Observable<ActivityDomainApiDto[]>` (`providedIn: 'root'`,
  cached — single HTTP request for the app's lifetime, the list rarely changes).
- Consumes: `ActivityDomainApiDto` (Task 2).

- [ ] **Step 1: Implement the service**

Create `src/app/dashboard/services/activity-domain.service.ts`:

```typescript
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '@app/core/models/api.models';
import { ActivityDomainApiDto } from '../models/registration-api.models';

@Injectable({ providedIn: 'root' })
export class ActivityDomainService {
  private readonly http = inject(HttpClient);
  private cached: Observable<ActivityDomainApiDto[]> | null = null;

  getAll(): Observable<ActivityDomainApiDto[]> {
    if (!this.cached) {
      this.cached = this.http
        .get<ApiResponse<ActivityDomainApiDto[]>>(`${environment.apiUrl}/activity-domains`)
        .pipe(
          map((res) => res.data),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }

    return this.cached;
  }
}
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: no new errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/services/activity-domain.service.ts
git commit -m "feat: add ActivityDomainService consuming the real activity-domains endpoint"
```

---

## Task 5: Extend `RegistrationService` with the registration-mutation endpoints

**Files:**
- Modify: `src/app/shared/services/registration.service.ts`

**Interfaces:**
- Produces: `getByEditionYear`, `patchEntity`, `patchStand`, `addManager`, `removeManager`,
  `uploadLogo`, `submit` — one method per backend route (exact routes in Global Constraints / design
  spec §3).
- Consumes: `EntityStepApiDto`, `StandStepApiDto`, `StandManagerApiDto`, `RegistrationDetailApiDto`,
  `EntityStepPayload`, `StandStepPayload`, `NewManagerPayload` (Task 2).

- [ ] **Step 1: Add the new methods**

Replace the entire content of `src/app/shared/services/registration.service.ts` with:

```typescript
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RegistrationSummary } from '@app/core/models/registration.model';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '@app/core/models/api.models';
import {
  EntityStepApiDto,
  RegistrationDetailApiDto,
  StandManagerApiDto,
  StandStepApiDto,
} from '@app/dashboard/models/registration-api.models';
import {
  EntityStepPayload,
  NewManagerPayload,
  StandStepPayload,
} from '@app/dashboard/models/edition-form.models';

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'registrations';

  /**
   * Retourne l'inscription liée à l'édition active (s'il y en a une déjà
   * démarrée) et l'historique des éditions passées de l'exposant connecté.
   */
  getMine(): Observable<ApiResponse<RegistrationSummary[]>> {
    return this.http.get<ApiResponse<RegistrationSummary[]>>(`${environment.apiUrl}/${this.baseUrl}/mine`);
  }

  /**
   * Get-or-create du brouillon d'inscription de l'exposant connecté pour l'édition donnée.
   */
  getByEditionYear(year: string): Observable<ApiResponse<RegistrationDetailApiDto>> {
    return this.http.get<ApiResponse<RegistrationDetailApiDto>>(
      `${environment.apiUrl}/${this.baseUrl}/by-edition-year/${year}`,
    );
  }

  patchEntity(id: string, body: Partial<EntityStepPayload>): Observable<ApiResponse<EntityStepApiDto>> {
    return this.http.patch<ApiResponse<EntityStepApiDto>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/entity`,
      body,
    );
  }

  patchStand(id: string, body: StandStepPayload): Observable<ApiResponse<StandStepApiDto>> {
    return this.http.patch<ApiResponse<StandStepApiDto>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/stand`,
      body,
    );
  }

  addManager(id: string, body: NewManagerPayload): Observable<ApiResponse<StandManagerApiDto>> {
    return this.http.post<ApiResponse<StandManagerApiDto>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/managers`,
      body,
    );
  }

  removeManager(id: string, managerId: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/managers/${managerId}`,
    );
  }

  uploadLogo(id: string, file: File): Observable<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ApiResponse<{ url: string }>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/logo`,
      formData,
    );
  }

  submit(id: string): Observable<ApiResponse<{ status: string }>> {
    return this.http.post<ApiResponse<{ status: string }>>(
      `${environment.apiUrl}/${this.baseUrl}/${id}/submit`,
      {},
    );
  }
}
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: no new errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/shared/services/registration.service.ts
git commit -m "feat: extend RegistrationService with registration-mutation endpoints"
```

---

## Task 6: `EditionFormStateService` — real load, id tracking, DTO mapping

**Files:**
- Modify: `src/app/dashboard/services/edition-form-state.service.ts`
- Modify: `src/app/dashboard/page/edition-form/edition-form-page.component.ts`
- Delete: `src/app/dashboard/services/mock-registrations.ts`

**Interfaces:**
- Produces: `loadForEditionYear(year: string): void` (now async, was synchronous returning
  `boolean`), `loading: Signal<boolean>`, `loadError: Signal<'not_found' | 'closed' | null>`, private
  helpers `toEntityStepState(dto: EntityStepApiDto): EntityStepState` and
  `toStandStepState(dto: StandStepApiDto): StandStepState` (consumed directly by Tasks 7 and 8 — do
  not redefine them there), private `patchLocalState` (renamed from `patchState`, no longer triggers
  any autosave itself — callers explicitly schedule the pipeline they need, added in Tasks 7-8).
  `standTotalTtc` now reads `state().stand.standTotalTtc` directly (the server-computed value that
  Task 6's own DTO mapper already carries) instead of recomputing client-side — this doesn't need to
  wait for Task 8's `OptionsCatalogService` wiring, since it never depended on the option catalogue
  cache, only on the registration DTO this task already maps.
- Consumes: `RegistrationService.getByEditionYear` (Task 5), `RegistrationDetailApiDto` and friends
  (Task 2).

This task intentionally does **not** wire the real option catalogue into `getOptionsByCategory` yet
(Task 8 — `getOptionsByCategory` is a temporary stub here, since `options-catalog.ts` no longer exists
after Task 2 and `OptionsCatalogService` isn't consumed by this service until Task 8). It also does not
yet wire the new Entité/Stand autosave pipelines (Tasks 7-8) — `updateEntity`, `selectSurfaceOption`,
`setOptionQuantity` will compile and update local state via the renamed `patchLocalState`, but won't
autosave to the server until their dedicated tasks land.

- [ ] **Step 1: Rewrite the service's load/state foundation**

In `src/app/dashboard/services/edition-form-state.service.ts`, replace the entire file content with:

```typescript
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import {
  AutosaveStatus,
  EditionRegistrationState,
  EntityStepState,
  OptionCategory,
  OptionDefinition,
  RegistrationStatus,
  RegistrationStep,
  StandManagerForm,
  StandStepState,
} from '../models/edition-form.models';
import {
  EntityStepApiDto,
  RegistrationDetailApiDto,
  StandStepApiDto,
} from '../models/registration-api.models';
import { RegistrationService } from '@app/shared/services/registration.service';

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

  private readonly state = signal<EditionRegistrationState | null>(null);
  private readonly activeStepSignal = signal<RegistrationStep>(RegistrationStep.ENTITY);
  private readonly autosaveStatusSignal = signal<AutosaveStatus>('idle');
  private readonly loadingSignal = signal(false);
  private readonly loadErrorSignal = signal<'not_found' | 'closed' | null>(null);
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly registration = this.state.asReadonly();
  readonly activeStep = this.activeStepSignal.asReadonly();
  readonly autosaveStatus = this.autosaveStatusSignal.asReadonly();
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

  /**
   * Stub temporaire : renvoie toujours un tableau vide. Task 8 branche le vrai catalogue via
   * `OptionsCatalogService` (l'ancien fichier statique `options-catalog.ts` a été supprimé au
   * Task 2 en même temps que le renommage de `OptionDefinition`, il n'y a donc rien à lire ici
   * avant que Task 8 introduise `optionsSignal`).
   */
  getOptionsByCategory(category: OptionCategory): OptionDefinition[] {
    void category;
    return [];
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
    this.autosaveStatusSignal.set('idle');

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
  }

  setOptionQuantity(optionId: string, quantity: number): void {
    this.patchLocalState((reg) => ({
      stand: {
        ...reg.stand,
        quantitiesByOptionId: { ...reg.stand.quantitiesByOptionId, [optionId]: Math.max(0, quantity) },
      },
    }));
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
```

This file, as written above, has **no remaining reference to the deleted `options-catalog.ts`** or to
the old `mockPriceTtc`/`mockVatRate` fields — it should compile cleanly on its own once this step is
applied.

- [ ] **Step 2: Fix the page component's now-`void` `loadForEditionYear` call**

In `src/app/dashboard/page/edition-form/edition-form-page.component.ts`, find:

```typescript
  ngOnInit(): void {
    const year = this.route.snapshot.paramMap.get('year');
    if (!year || !this.formState.loadForEditionYear(year)) {
      this.notFound = true;
    }
  }
```

Replace with:

```typescript
  ngOnInit(): void {
    const year = this.route.snapshot.paramMap.get('year');
    if (!year) {
      this.notFound = true;
      return;
    }
    this.formState.loadForEditionYear(year);
  }
```

(Full loading/error UX polish using the new `loading`/`loadError` signals is Task 14 — this step only
keeps the component compiling and functionally correct: `notFound` still catches the "no `:year` in
the route" edge case, and the page will render nothing extra until `registration()` becomes truthy,
which is acceptable for this intermediate task.)

- [ ] **Step 3: Delete the mock**

```bash
rm src/app/dashboard/services/mock-registrations.ts
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: build still fails, but now with errors in **only** these two files (both fixed by their own
dedicated later task — confirm the error list has narrowed to exactly this, down from Task 2's four):
- `src/app/dashboard/page/edition-form/components/steps/entity/step-entity.component.ts`/`.html` —
  `visualFileName`/`activityDomain` (fixed in Task 12).
- `src/app/dashboard/page/edition-form/components/steps/stand/step-stand.component.ts`/`.html` —
  imports the deleted `options-catalog.ts`, reads `.mockPriceTtc` (fixed in Task 13).

Run: `npm start`, open `http://localhost:4200`, log in, navigate to `/mon-espace/dashboard`.
Expected: page loads without new console errors (the registration form page itself will still fail to
render/build until Tasks 12-13 land — that's expected at this point).

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/services/edition-form-state.service.ts \
        src/app/dashboard/page/edition-form/edition-form-page.component.ts
git rm src/app/dashboard/services/mock-registrations.ts
git commit -m "feat: load real registration data, track registration id, remove mock-registrations"
```

---

## Task 7: Entité autosave pipeline

**Files:**
- Modify: `src/app/dashboard/services/edition-form-state.service.ts`

**Interfaces:**
- Produces: `entityAutosaveStatus: Signal<AutosaveStatus>` (replaces the single `autosaveStatus` for
  the Entité step — Task 8 adds the Stand equivalent and Task 14 wires both into the page header).
- Consumes: `RegistrationService.patchEntity` (Task 5), `toEntityStepState` (Task 6), `MessageService`
  (Task 1).

- [ ] **Step 1: Add the Entité autosave pipeline**

In `src/app/dashboard/services/edition-form-state.service.ts`:

Add the `MessageService` import:

```typescript
import { MessageService } from 'primeng/api';
```

Add `EntityStepPayload` to the existing import list from `'../models/edition-form.models'` (the
`AutosaveStatus, EditionRegistrationState, ...` block from Task 6) rather than a new import statement.

Replace the single autosave signal/timer declarations:

```typescript
  private readonly autosaveStatusSignal = signal<AutosaveStatus>('idle');
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly autosaveStatus = this.autosaveStatusSignal.asReadonly();
```

with:

```typescript
  private readonly entityAutosaveStatusSignal = signal<AutosaveStatus>('idle');
  private entityAutosaveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly entityAutosaveStatus = this.entityAutosaveStatusSignal.asReadonly();
```

(The Stand equivalent is added in Task 8 — until then, only Entité autosaves.)

Add the `MessageService` injection alongside `registrationService`:

```typescript
  private readonly registrationService = inject(RegistrationService);
  private readonly messageService = inject(MessageService);
```

Update `loadForEditionYear` to reset the renamed signal — replace:

```typescript
    this.autosaveStatusSignal.set('idle');
```

with:

```typescript
    this.entityAutosaveStatusSignal.set('idle');
```

Update `updateEntity` to trigger the pipeline:

```typescript
  updateEntity(patch: Partial<EditionRegistrationState['entity']>): void {
    this.patchLocalState((reg) => ({ entity: { ...reg.entity, ...patch } }));
    this.scheduleEntityAutosave();
  }
```

Add the pipeline method (place it near the bottom, before the DTO-mapping section):

```typescript
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
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: this rename introduces one **new** error beyond the ones already known from Task 6:
`edition-form-page.component.ts` references `formState.autosaveStatus()`, which no longer exists
(fixed in Task 14). Full project build success is not expected until Task 14 — at every checkpoint
between Task 6 and Task 14, `step-entity.component.ts`/`.html` (fixed in Task 12) and
`step-stand.component.ts`/`.html` (fixed in Task 13) remain broken from Task 2's renames; that's
expected and not a regression introduced by this task.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/services/edition-form-state.service.ts
git commit -m "feat: wire real autosave for the Entité step"
```

---

## Task 8: Stand autosave pipeline + real option catalogue

**Files:**
- Modify: `src/app/dashboard/services/edition-form-state.service.ts`

**Interfaces:**
- Produces: `standAutosaveStatus: Signal<AutosaveStatus>`. `getOptionsByCategory` now reads from
  `OptionsCatalogService`'s cached signal instead of returning the empty stub Task 6 left in place.
- Consumes: `RegistrationService.patchStand` (Task 5), `OptionsCatalogService.getForEdition` (Task 3),
  `toStandStepState` (Task 6). `standTotalTtc` was already switched to the server-computed value in
  Task 6 — this task doesn't touch it again.

- [ ] **Step 1: Wire the real option catalogue and stand autosave**

In `src/app/dashboard/services/edition-form-state.service.ts`:

Add the `OptionsCatalogService` import:

```typescript
import { OptionsCatalogService } from '@app/dashboard/services/options-catalog.service';
```

Add `StandStepPayload` to the existing import list from `'../models/edition-form.models'` (the one
Task 7 already extended with `EntityStepPayload` — add `StandStepPayload` alongside it; `OptionDefinition`
is already in that list from Task 6, don't duplicate it).

Add the service injection and an options signal, alongside the existing injections:

```typescript
  private readonly optionsCatalogService = inject(OptionsCatalogService);
  private readonly optionsSignal = signal<OptionDefinition[]>([]);
```

Add the Stand autosave signal/timer next to the Entité ones:

```typescript
  private readonly standAutosaveStatusSignal = signal<AutosaveStatus>('idle');
  private standAutosaveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly standAutosaveStatus = this.standAutosaveStatusSignal.asReadonly();
```

Replace the Task 6 stub `getOptionsByCategory` (the one that always returned `[]`) with the real
filter over the newly-populated `optionsSignal`:

```typescript
  getOptionsByCategory(category: OptionCategory): OptionDefinition[] {
    return this.optionsSignal().filter((option) => option.category === category);
  }
```

Add a private lookup used by nothing yet outside this file (kept for symmetry/future use, mirrors the
old `getOptionById` helper):

```typescript
  private getOptionById(id: string): OptionDefinition | undefined {
    return this.optionsSignal().find((option) => option.id === id);
  }
```

Update `loadForEditionYear` to fetch the catalogue alongside the registration, and reset the new
autosave signal — replace the whole method with:

```typescript
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
```

Update `selectSurfaceOption` and `setOptionQuantity` to trigger the pipeline:

```typescript
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
```

Add the pipeline method, next to `scheduleEntityAutosave`:

```typescript
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
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: `edition-form-state.service.ts` itself now compiles cleanly — this task introduces no new
errors. `step-entity.component.ts`/`.html` (Task 12), `step-stand.component.ts`/`.html` (Task 13), and
`edition-form-page.component.ts` (Task 14, `autosaveStatus` rename from Task 7) remain broken, as
expected at this point in the plan.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/services/edition-form-state.service.ts
git commit -m "feat: wire real autosave and real option catalogue for the Stand step"
```

---

## Task 9: Stand manager CRUD (immediate, not debounced)

**Files:**
- Modify: `src/app/dashboard/services/edition-form-state.service.ts`

**Interfaces:**
- Produces: `addManager(manager: Omit<StandManagerForm, 'id'>): void` (signature change — the id is no
  longer supplied by the caller, the service generates a temporary optimistic id itself; Task 12
  updates the call site). `removeManager` keeps its existing signature.
- Consumes: `RegistrationService.addManager`/`removeManager` (Task 5), `NewManagerPayload` (Task 2).

- [ ] **Step 1: Replace `addManager`/`removeManager` with immediate API calls**

In `src/app/dashboard/services/edition-form-state.service.ts`, add `NewManagerPayload` to the existing
import list from `'../models/edition-form.models'` (alongside `EntityStepPayload`/`StandStepPayload`
added in Tasks 7-8).

Replace both methods:

```typescript
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
```

Note the deliberate asymmetry: `addManager` updates local state optimistically (so the UI feels
instant when typing a new manager) and rolls back on failure; `removeManager` waits for server
confirmation before removing the row locally (per the design spec §5 — avoids visually "losing" a
manager on a network blip that later turns out to have failed).

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: this task's signature change adds one more error inside the already-broken
`step-entity.component.ts` (`addManager({ id: crypto.randomUUID(), ... })` no longer matches — both
fixed together in Task 12). No new errors should appear anywhere else.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/services/edition-form-state.service.ts
git commit -m "feat: wire real immediate CRUD for stand managers"
```

---

## Task 10: Logo upload

**Files:**
- Modify: `src/app/dashboard/services/edition-form-state.service.ts`

**Interfaces:**
- Produces: `uploadLogo(file: File): void` (new method — the old flow piggybacked on `updateEntity`
  with just a filename string, this is a real dedicated upload).
- Consumes: `RegistrationService.uploadLogo` (Task 5).

- [ ] **Step 1: Add the upload method**

In `src/app/dashboard/services/edition-form-state.service.ts`, add near `addManager`/`removeManager`:

```typescript
  uploadLogo(file: File): void {
    const reg = this.state();
    if (!reg || this.isReadOnly()) {
      return;
    }

    this.registrationService.uploadLogo(reg.id, file).subscribe({
      next: (response) => {
        this.state.update((current) =>
          current ? { ...current, entity: { ...current.entity, visualUrl: response.data.url } } : current,
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
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: no new errors (this is a purely additive method, nothing consumes it until Task 12).

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/services/edition-form-state.service.ts
git commit -m "feat: add real logo upload method"
```

---

## Task 11: Submit with server-side validation surfacing

**Files:**
- Modify: `src/app/dashboard/services/edition-form-state.service.ts`

**Interfaces:**
- Produces: `submitStatus: Signal<'idle' | 'submitting' | 'submitted' | 'error'>`.
  `submitRegistrationOptions(): void` (return type changes from `boolean` to `void` — callers now read
  `submitStatus()` instead of the old synchronous return value; Task 13 updates the call site).
- Consumes: `RegistrationService.submit` (Task 5).

- [ ] **Step 1: Replace `submitRegistrationOptions`**

In `src/app/dashboard/services/edition-form-state.service.ts`, add the signal declaration near the
other status signals:

```typescript
  private readonly submitStatusSignal = signal<'idle' | 'submitting' | 'submitted' | 'error'>('idle');

  readonly submitStatus = this.submitStatusSignal.asReadonly();
```

Replace the method:

```typescript
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
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: this return-type change adds one more error inside the already-broken
`step-stand.component.ts` (`this.submitted.set(this.formState.submitRegistrationOptions())` — the
method no longer returns a value, both fixed together in Task 13). No new errors anywhere else.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/services/edition-form-state.service.ts
git commit -m "feat: wire real submit endpoint with server-side validation errors"
```

---

## Task 12: `StepEntityComponent` — real activity domains, logo upload, manager call-site fix

**Files:**
- Modify: `src/app/dashboard/page/edition-form/components/steps/entity/step-entity.component.ts`
- Modify: `src/app/dashboard/page/edition-form/components/steps/entity/step-entity.component.html`

**Interfaces:**
- Consumes: `ActivityDomainService.getAll()` (Task 4), `EditionFormStateService.uploadLogo` (Task 10),
  `EditionFormStateService.addManager` new signature (Task 9), `EntityStepState.activityDomainId`/
  `visualUrl` (Task 2).

- [ ] **Step 1: Update the component class**

Replace the entire content of `step-entity.component.ts` with:

```typescript
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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

  protected activityDomainOptions: ActivityDomainApiDto[] = [];

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
    this.activityDomainService.getAll().subscribe((domains) => {
      this.activityDomainOptions = domains;
    });

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
```

- [ ] **Step 2: Update the template**

In `step-entity.component.html`:

Replace the domain input:

```html
          <div class="ef-field">
            <label class="ef-label" for="activityDomain">Domaine d'activité *</label>
            <input pInputText id="activityDomain" class="w-full" formControlName="activityDomain" />
            @if (form.controls.activityDomain.touched && form.controls.activityDomain.invalid) {
              <p class="ef-field-error">Le domaine d'activité est obligatoire pour un exposant professionnel.</p>
            }
          </div>
```

with:

```html
          <div class="ef-field">
            <label class="ef-label" for="activityDomainId">Domaine d'activité *</label>
            <p-select
              inputId="activityDomainId"
              formControlName="activityDomainId"
              [options]="activityDomainOptions"
              optionLabel="label"
              optionValue="id"
              styleClass="w-full"
            />
            @if (form.controls.activityDomainId.touched && form.controls.activityDomainId.invalid) {
              <p class="ef-field-error">Le domaine d'activité est obligatoire pour un exposant professionnel.</p>
            }
          </div>
```

Replace the visual filename display:

```html
        @if (registration.entity.visualFileName) {
          <p class="ef-help-text">Fichier actuel : {{ registration.entity.visualFileName }}</p>
        }
```

with:

```html
        @if (registration.entity.visualUrl) {
          <p class="ef-help-text">
            Fichier actuel :
            <a [href]="registration.entity.visualUrl" target="_blank" rel="noopener">{{ registration.entity.visualUrl }}</a>
          </p>
        }
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: `step-entity.component.ts`/`.html` now compile cleanly — no more
`visualFileName`/`activityDomain`/`addManager`-signature errors anywhere in this file. The overall
`npm run build` still fails at this point, with errors now narrowed to exactly
`step-stand.component.ts`/`.html` (Task 13) and `edition-form-page.component.ts`'s `autosaveStatus`
reference (Task 14) — confirm nothing remains in this task's two files.

Run: `npm start`, backend running at `http://localhost:8000` (see Task 15 for backend startup), log in
as a test exhibitor, navigate to the Entité step.
Expected: the domain dropdown shows real options fetched from `/api/activity-domains`; typing in the
company name field triggers a network request to `PATCH .../entity` roughly 800ms after you stop
typing (check the Network tab); selecting a logo file triggers `POST .../logo` and the "Fichier
actuel" link updates.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page/edition-form/components/steps/entity/step-entity.component.ts \
        src/app/dashboard/page/edition-form/components/steps/entity/step-entity.component.html
git commit -m "feat: wire StepEntityComponent to real activity domains and logo upload"
```

---

## Task 13: `StepStandComponent` — real prices, real options, real submit status

**Files:**
- Modify: `src/app/dashboard/page/edition-form/components/steps/stand/step-stand.component.ts`
- Modify: `src/app/dashboard/page/edition-form/components/steps/stand/step-stand.component.html`

**Interfaces:**
- Consumes: `EditionFormStateService.getOptionsByCategory` (now real, Task 8),
  `EditionFormStateService.submitStatus` (Task 11), `OptionDefinition.priceTtc` (Task 2).

- [ ] **Step 1: Update the component class**

Replace the entire content of `step-stand.component.ts` with:

```typescript
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { AccordionModule } from 'primeng/accordion';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputNumberModule } from 'primeng/inputnumber';
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

  protected surfaceOptions() {
    return this.formState.getOptionsByCategory(OptionCategory.SURFACE);
  }

  protected optionsForCategory(category: OptionCategory) {
    return this.formState.getOptionsByCategory(category);
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
   * Envoi de la demande de stand une fois le formulaire valide. Le statut réel (submitting/
   * submitted/error) est lu directement depuis `formState.submitStatus()` dans le template.
   */
  protected submit(): void {
    if (!this.validateAndTouch()) {
      return;
    }
    this.formState.submitRegistrationOptions();
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
```

- [ ] **Step 2: Update the template**

Replace the entire content of `step-stand.component.html` with:

```html
@if (formState.registration(); as registration) {
  <form [formGroup]="form">
    <div class="ef-panel">
      <h2 class="ef-section-title">Surface de stand</h2>
      <p class="ef-help-text mb-4">
        La commande d'un pack génère la mise à disposition d'une surface nue, des badges
        exposants associés et d'un sticker pare-brise donnant accès au parking exposants.
      </p>

      <div class="flex flex-col gap-1">
        @for (option of surfaceOptions(); track option.id) {
          <div class="ef-option-row">
            <div class="flex items-center gap-2">
              <p-radio-button
                [inputId]="option.id"
                formControlName="selectedSurfaceOptionId"
                [value]="option.id"
              />
              <label [for]="option.id" class="ef-option-label">{{ option.label }}</label>
            </div>
            <span class="ef-option-price">{{ option.priceTtc | number: '1.0-2' }} € TTC</span>
          </div>
        }
      </div>

      @if (form.controls.selectedSurfaceOptionId.touched && form.controls.selectedSurfaceOptionId.invalid) {
        <p class="ef-field-error mt-2">Sélectionnez une surface de stand pour continuer.</p>
      }
    </div>
  </form>

  <div class="ef-panel mt-6">
    <h2 class="ef-section-title">Options complémentaires</h2>

    <p-accordion [multiple]="true">
      @for (category of addonCategories; track category) {
        <p-accordion-panel [value]="category">
          <p-accordion-header>{{ categoryLabel(category) }}</p-accordion-header>
          <p-accordion-content>
            @for (option of optionsForCategory(category); track option.id) {
              <div class="ef-option-row">
                <span class="ef-option-label">
                  {{ option.label }}
                  @if (option.unit) {
                    <span class="ef-muted">({{ option.unit }})</span>
                  }
                </span>
                <div class="flex items-center gap-3">
                  <span class="ef-option-price">{{ option.priceTtc | number: '1.0-2' }} € TTC / unité</span>
                  <p-input-number
                    [ngModel]="quantityFor(option.id)"
                    [ngModelOptions]="{ standalone: true }"
                    (ngModelChange)="formState.setOptionQuantity(option.id, $event ?? 0)"
                    [min]="0"
                    [showButtons]="true"
                    [disabled]="formState.isReadOnly()"
                    inputStyleClass="w-24 text-center"
                  />
                </div>
              </div>
            }
          </p-accordion-content>
        </p-accordion-panel>
      }
    </p-accordion>

    @if (!formState.isReadOnly()) {
      <div class="mt-5">
        <p-button
          label="Faire une commande complémentaire"
          icon="pi pi-envelope"
          [outlined]="true"
          (onClick)="requestAdditionalOrder()"
        />
      </div>
    }

    <div class="ef-summary-card">
      <div class="ef-summary-row ef-summary-row--total">
        <span>Total du stand</span>
        <span>{{ formState.standTotalTtc() | number: '1.0-2' }} € TTC</span>
      </div>
    </div>

    @if (!formState.isReadOnly()) {
      <div class="mt-5 flex flex-col items-start gap-2">
        <p-button
          label="Envoyer ma demande"
          icon="pi pi-send"
          [disabled]="form.invalid || formState.submitStatus() === 'submitting'"
          [loading]="formState.submitStatus() === 'submitting'"
          (onClick)="submit()"
        />
        @if (formState.submitStatus() === 'submitted') {
          <p class="ef-field-success">Votre demande a bien été envoyée à l'organisation.</p>
        }
      </div>
    }
  </div>
}
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: `step-stand.component.ts`/`.html` now compile cleanly — no more references to
`option.mockPriceTtc`, the deleted `options-catalog.ts`, or the old boolean
`submitRegistrationOptions()`/`submitted` signal. The overall `npm run build` still fails at this
point, with the error now narrowed to exactly `edition-form-page.component.ts`'s `autosaveStatus`
reference (Task 14) — confirm that's the only remaining error in the whole project.

Run: `npm start`, backend running, navigate to the Stand step.
Expected: real surface prices and add-on prices are displayed (matching the seeded 2030 catalogue —
Pro exhibitor sees 310€ for 9m², Club sees 108€, per the backend's Task 4 seed data); selecting a
surface or changing a quantity triggers `PATCH .../stand` ~800ms later; the displayed total updates to
the **server-returned** value after that save completes (a brief lag between local click and total
update is expected and correct — the total is no longer computed client-side).

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page/edition-form/components/steps/stand/step-stand.component.ts \
        src/app/dashboard/page/edition-form/components/steps/stand/step-stand.component.html
git commit -m "feat: wire StepStandComponent to real option prices and submit status"
```

---

## Task 14: `EditionFormPageComponent` — loading/error UX, per-step autosave indicator

**Files:**
- Modify: `src/app/dashboard/page/edition-form/edition-form-page.component.ts`
- Modify: `src/app/dashboard/page/edition-form/edition-form-page.component.html`

**Interfaces:**
- Consumes: `EditionFormStateService.loading`, `loadError`, `entityAutosaveStatus`,
  `standAutosaveStatus` (Tasks 6-8), `RegistrationStep`, `AutosaveStatus` (Task 2).

- [ ] **Step 1: Update the component class**

Replace the entire content of `edition-form-page.component.ts` with:

```typescript
import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StepperModule } from 'primeng/stepper';
import { ButtonModule } from 'primeng/button';
import {
  StepConfirmationComponent
} from '@app/dashboard/page/edition-form/components/steps/confirmation/step-confirmation.component';
import { StepStandComponent } from '@app/dashboard/page/edition-form/components/steps/stand/step-stand.component';
import { StepEntityComponent } from '@app/dashboard/page/edition-form/components/steps/entity/step-entity.component';
import {
  StepDocumentsComponent
} from '@app/dashboard/page/edition-form/components/steps/documents/step-documents.component';
import { StepPaymentComponent } from '@app/dashboard/page/edition-form/components/steps/payment/step-payment.component';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { AutosaveStatus, RegistrationStep } from '@app/dashboard/models/edition-form.models';
import { ValidatableFormStep } from '@app/dashboard/models/validatable-form-step';
import { LoaderComponent } from '@app/shared/components/loader/loader.component';

@Component({
  selector: 'app-edition-form-page',
  imports: [
    StepperModule,
    ButtonModule,
    StepEntityComponent,
    StepStandComponent,
    StepConfirmationComponent,
    StepDocumentsComponent,
    StepPaymentComponent,
    LoaderComponent,
  ],
  styleUrl: '../../../core/styles/edition-form.theme.css',
  templateUrl: './edition-form-page.component.html',
  standalone: true
})
export class EditionFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly formState = inject(EditionFormStateService);

  @ViewChild(StepEntityComponent) private readonly entityStep?: StepEntityComponent;
  @ViewChild(StepStandComponent) private readonly standStep?: StepStandComponent;

  protected readonly RegistrationStep = RegistrationStep;
  protected missingYearParam = false;

  ngOnInit(): void {
    const year = this.route.snapshot.paramMap.get('year');
    if (!year) {
      this.missingYearParam = true;
      return;
    }
    this.formState.loadForEditionYear(year);
  }

  protected onStepChange(value: number | undefined): void {
    if (value === undefined) {
      return;
    }
    this.formState.goToStep(value as RegistrationStep);
  }

  /** Statut d'autosave à afficher dans l'en-tête : celui de l'étape actuellement affichée. */
  protected currentAutosaveStatus(): AutosaveStatus {
    switch (this.formState.activeStep()) {
      case RegistrationStep.ENTITY:
        return this.formState.entityAutosaveStatus();
      case RegistrationStep.STAND:
        return this.formState.standAutosaveStatus();
      default:
        return 'idle';
    }
  }

  /**
   * Le composant de l'étape courante (s'il porte une validation bloquante) n'est monté que
   * lorsqu'elle est active dans le `p-stepper` — seule une des deux `@ViewChild` est donc
   * définie à un instant donné. Les étapes Confirmation/Documents/Paiement n'ont pas de garde
   * de progression ici, elles gèrent leurs propres règles (checklist, statut backend).
   */
  private currentValidatableStep(): ValidatableFormStep | undefined {
    switch (this.formState.activeStep()) {
      case RegistrationStep.ENTITY:
        return this.entityStep;
      case RegistrationStep.STAND:
        return this.standStep;
      default:
        return undefined;
    }
  }

  protected goToNextStep(): void {
    const currentStep = this.currentValidatableStep();
    if (currentStep && !currentStep.validateAndTouch()) {
      return;
    }
    this.formState.goToNextStep();
  }
}
```

- [ ] **Step 2: Update the template**

Replace the entire content of `edition-form-page.component.html` with:

```html
<div class="ef-shell">
  @if (missingYearParam) {
    <div class="ef-content">
      <p class="ef-muted">Aucune édition spécifiée.</p>
    </div>
  } @else if (formState.loading()) {
    <div class="ef-content">
      <app-loader message="Chargement de votre inscription..." />
    </div>
  } @else if (formState.loadError(); as error) {
    <div class="ef-content">
      <p class="ef-muted">
        @if (error === 'closed') {
          Les inscriptions ne sont pas ouvertes pour cette édition.
        } @else {
          Aucune inscription trouvée pour cette édition.
        }
      </p>
    </div>
  } @else if (formState.registration(); as registration) {
    <header class="ef-header">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p class="ef-muted text-sm">Mon espace exposant</p>
          <h1 class="ef-header-title">Formulaire d'inscription {{ registration.editionYear }}</h1>
        </div>

        @if (!registration.readOnly) {
          <div
            class="ef-autosave-indicator"
            [class.ef-autosave-indicator--error]="currentAutosaveStatus() === 'error'"
          >
            @switch (currentAutosaveStatus()) {
              @case ('saving') {
                <i class="pi pi-spin pi-spinner"></i>
                <span>Enregistrement...</span>
              }
              @case ('saved') {
                <i class="pi pi-check"></i>
                <span>Enregistré</span>
              }
              @case ('error') {
                <i class="pi pi-exclamation-triangle"></i>
                <span>Échec de la sauvegarde</span>
              }
            }
          </div>
        }
      </div>

      @if (registration.readOnly) {
        <div class="ef-readonly-banner">
          <i class="pi pi-lock"></i>
          <span>
            Édition passée — ce formulaire est affiché à titre d'historique et n'est plus modifiable.
          </span>
        </div>
      }
    </header>

    <div class="ef-content">
      <div class="ef-stepper-wrapper">
        <p-stepper [value]="formState.activeStep()" (valueChange)="onStepChange($event)">
          <p-step-list>
            <p-step [value]="RegistrationStep.ENTITY" [disabled]="!formState.isStepUnlocked()(RegistrationStep.ENTITY)">
              Entité
            </p-step>
            <p-step [value]="RegistrationStep.STAND" [disabled]="!formState.isStepUnlocked()(RegistrationStep.STAND)">
              Stand
            </p-step>
            <p-step [value]="RegistrationStep.CONFIRMATION" [disabled]="!formState.isStepUnlocked()(RegistrationStep.CONFIRMATION)">
              Confirmation
            </p-step>
            <p-step [value]="RegistrationStep.DOCUMENTS" [disabled]="!formState.isStepUnlocked()(RegistrationStep.DOCUMENTS)">
              Documents
            </p-step>
            <p-step [value]="RegistrationStep.PAYMENT" [disabled]="!formState.isStepUnlocked()(RegistrationStep.PAYMENT)">
              Paiement
            </p-step>
          </p-step-list>

          <p-step-panels>
            <p-step-panel [value]="RegistrationStep.ENTITY">
              <ng-template #content>
                <app-step-entity />
              </ng-template>
            </p-step-panel>

            <p-step-panel [value]="RegistrationStep.STAND">
              <ng-template #content>
                <app-step-stand />
              </ng-template>
            </p-step-panel>

            <p-step-panel [value]="RegistrationStep.CONFIRMATION">
              <ng-template #content>
                <app-step-confirmation />
              </ng-template>
            </p-step-panel>

            <p-step-panel [value]="RegistrationStep.DOCUMENTS">
              <ng-template #content>
                <app-step-documents />
              </ng-template>
            </p-step-panel>

            <p-step-panel [value]="RegistrationStep.PAYMENT">
              <ng-template #content>
                <app-step-payment />
              </ng-template>
            </p-step-panel>
          </p-step-panels>
        </p-stepper>
      </div>

      <div class="ef-actions-row">
        @if (!formState.isFirstStep()) {
          <p-button
            label="Précédent"
            icon="pi pi-arrow-left"
            severity="secondary"
            [outlined]="true"
            (onClick)="formState.goToPreviousStep()"
          />
        } @else {
          <span></span>
        }

        @if (!formState.isLastStep()) {
          <p-button
            label="Suivant"
            icon="pi pi-arrow-right"
            iconPos="right"
            (onClick)="goToNextStep()"
          />
        }
      </div>
    </div>
  }
</div>
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: build succeeds cleanly, no errors anywhere in the project.

Run: `npm start`, backend running, navigate to `/edition/2030` (a year with no registration open, if
any exists — otherwise temporarily point at a closed/non-existent year via the URL) to see the
`loadError` message, then to a real open year to see the loader flash briefly then the form render.
Expected: distinct messages for "no edition found" vs "registration closed"; the autosave indicator in
the header shows Entité's status while on the Entité step and Stand's status while on the Stand step
(switch steps mid-save to confirm they're independent — editing a field on Entité, immediately
switching to Stand before the debounce fires, should show the Stand step with an idle indicator, not
"saving").

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page/edition-form/edition-form-page.component.ts \
        src/app/dashboard/page/edition-form/edition-form-page.component.html
git commit -m "feat: wire loading/error UX and per-step autosave indicator"
```

---

## Task 15: Full manual end-to-end verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Start the real backend**

```bash
cd C:\Users\antoi\Documents\Programmation\AE\HistoricAuto\historicauto-back\.claude\worktrees\registration-form-backend-api
php -S 127.0.0.1:8000 -t public
```

Confirm the edition 2030 catalogue is seeded (re-run if needed — idempotent):

```bash
php bin/console app:catalog:seed 2030
```

Confirm (or create via `/admin`) an `Edition` row for year 2030 with `isActive=true`,
`registrationOpen=true`, `isVisible=true`.

- [ ] **Step 2: Start the frontend**

```bash
cd C:\Users\antoi\Documents\Programmation\AE\HistoricAuto\historicauto-front
npm start
```

- [ ] **Step 3: Full Pro exhibitor flow**

1. Register/log in as a fresh exhibitor account, navigate to `/edition/2030`.
2. Entité step: select "Professionnel", fill company name, SIRET, pick a real activity domain from
   the dropdown, add a stand manager, upload a logo image.
   Expected: each field change triggers a debounced `PATCH .../entity` (Network tab); the manager
   appears immediately with a temporary id, then updates to a server UUID; the logo upload shows a
   success Toast and the "Fichier actuel" link becomes clickable and loads the image.
3. Move to Stand step: select the 9m² surface, add 9 units of Moquette.
   Expected: total shows **364,00 € TTC** (310€ Pro price + 9×6€) after the autosave round-trip — the
   exact figure from `docs/superpowers/plans/2026-07-12-registration-form-backend-api.md` Task 10's
   own manual verification. Removing the Moquette should drop the total back to 310,00 €.
4. Click "Envoyer ma demande".
   Expected: success message, `registration.status` becomes `submitted` (confirm via
   `GET /api/registrations/mine` in the Network tab or a direct curl with the exhibitor's token), the
   Entité/Stand steps become read-only.
5. Simulate a submit validation failure: create a second fresh registration, go straight to Stand
   without filling Entité fields, try to submit with no surface selected — confirm the "Suivant"
   button on Stand itself is disabled by client validation, then (to reach the server 422 path)
   directly call `formState.submitRegistrationOptions()` from the browser console after selecting a
   surface but leaving SIRET empty — confirm a Toast shows the server's French validation message.

- [ ] **Step 4: Full Club exhibitor flow**

Repeat steps 3.2-3.3 with a fresh account selecting "Club" instead of "Professionnel" (club type
"Généraliste", no SIRET/domain fields shown), same 9m² surface selection.
Expected: total shows **108,00 € TTC** for the surface alone — the Club price, not the Pro price,
confirming `OptionsCatalogService` and the Stand autosave correctly resolve per-exhibitor-type
pricing end-to-end through the real UI (not just via curl, as the backend plan already verified).

- [ ] **Step 5: Network failure resilience**

With DevTools open, switch to "Offline" in the Network conditions panel, edit a field on the Entité
step.
Expected: the autosave indicator shows "saving" then flips to the error state, and a red error Toast
appears. Switch back online and edit the field again — expect a successful save this time (status
returns to "Enregistré").

- [ ] **Step 6: Read-only historical view**

Navigate to a past, non-active edition's registration (if one exists in the seeded data — otherwise
skip this step and note it in the final report) via `/mon-espace/historique/:id` or the equivalent
route, confirm all fields are disabled and no autosave indicator is shown.

- [ ] **Step 7: Final full build check**

Run: `npm run build`
Expected: production build succeeds with no errors or new warnings.

- [ ] **Step 8: Stop local servers**

Stop both `php -S` and `npm start` processes.

- [ ] **Step 9: Commit** (only if Step 3-6 surfaced fixes worth keeping — otherwise this task has no
  code changes and no commit)

If any fixes were made during manual verification:

```bash
git add -A
git commit -m "fix: address issues found during end-to-end manual verification"
```
