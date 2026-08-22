# Mon Espace — statut & historique : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher sur `/dashboard` le statut de la demande de l'édition active dans une carte dédiée, et lister les éditions précédentes en dessous avec un lien de consultation.

**Architecture:** `MonEspaceHomeComponent` reste le seul composant qui charge des données ; il délègue tout l'affichage à deux composants de présentation purs (`ActiveRegistrationCardComponent`, `PastRegistrationsListComponent`) qui reçoivent leurs données par `input()` et remontent la navigation par `output()`. Le mapping statut → libellé/couleur est extrait dans une paire de fonctions pures partagées par les deux composants. Aucune modification du back.

**Tech Stack:** Angular 21 (composants standalone, signal inputs/outputs, `ChangeDetectionStrategy.OnPush`), PrimeNG 21 (`p-card`, `p-tag`, `p-button`), Tailwind 4 + les classes du thème maison `auth.theme.css`.

## Global Constraints

- **Aucune modification back.** `RegistrationSummaryDto`, `EditionRegistrationRepository` et l'API restent inchangés. Le statut affiché provient uniquement des 7 valeurs de `RegistrationStatus` plus le cas « pas de Registration ».
- **Pas de tests automatisés** — préférence établie sur ce projet. Chaque tâche se vérifie par `npm run build` (zéro erreur) et, pour les tâches visibles, par un contrôle à l'écran.
- **`strictTemplates: true`** est actif dans `tsconfig.json` : tout ce qui est utilisé dans un template doit être typé et accessible (`protected` ou `public`, jamais `private`).
- **Alias d'import :** `@app/*` pointe sur `./src/app/*`. Les imports `environments` restent relatifs.
- **Style des composants existants à respecter :** `standalone: true`, `templateUrl` dans un fichier `.html` séparé, membres de template en `protected`, commentaires de doc en français expliquant le *pourquoi* (cf. `components/options-recap/options-recap.component.ts`).
- **Libellés exacts** — à copier tels quels, ils sont validés :
  - `not-started` → `Pas commencée`
  - `draft` → `Brouillon`
  - `submitted` → `Envoyée — en cours d'étude`
  - `accepted` → `Acceptée`
  - `waitlisted` → `Liste d'attente`
  - `refused` → `Refusée`
  - `confirmed` → `Confirmée`
  - `completed` → `Terminée`
- **Branche de travail :** `feat/mon-espace-statut-historique` (déjà créée, contient le commit de la spec).

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/app/core/utils/registration-status.util.ts` *(créé)* | Fonctions pures `statusLabel()` / `statusSeverity()` + les types `DisplayRegistrationStatus` et `RegistrationStatusSeverity`. Aucune dépendance Angular. |
| `src/app/dashboard/components/active-registration-card/active-registration-card.component.{ts,html}` *(créés)* | Rend la carte de l'édition active : statut, phrase d'accompagnement, bannière de refus, mention « inscriptions fermées », bouton d'action. Gère aussi le cas « aucune édition active ». |
| `src/app/dashboard/components/past-registrations-list/past-registrations-list.component.{ts,html}` *(créés)* | Rend la liste des éditions précédentes. Ne rend rien si le tableau est vide. |
| `src/app/dashboard/page/mon-espace-home/mon-espace-home.component.{ts,html}` *(réécrits)* | Charge les données, calcule `currentRegistration` / `pastRegistrations`, câble les deux composants et la navigation. |
| `src/app/dashboard/dashboard.routes.ts` *(modifié)* | Ajout de `authGuard` sur `edition/:year`. |
| `src/environments/environment.ts` et `environment.development.ts` *(modifiés)* | Ajout de `contactEmail`. |

---

### Task 1 : Fonctions de statut partagées

**Files:**
- Create: `src/app/core/utils/registration-status.util.ts`

**Interfaces:**
- Consumes: `RegistrationStatus` depuis `@app/core/models/registration.model` (union de 7 littéraux : `'draft' | 'submitted' | 'accepted' | 'refused' | 'waitlisted' | 'confirmed' | 'completed'`).
- Produces: le type `DisplayRegistrationStatus = RegistrationStatus | 'not-started'`, le type `RegistrationStatusSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary'`, et les fonctions `statusLabel(status: DisplayRegistrationStatus): string` et `statusSeverity(status: DisplayRegistrationStatus): RegistrationStatusSeverity`. Les tâches 2 et 3 importent ces quatre symboles.

- [ ] **Step 1 : Créer le fichier**

Créer `src/app/core/utils/registration-status.util.ts` avec exactement ce contenu :

```ts
import { RegistrationStatus } from '@app/core/models/registration.model';

/**
 * Sous-ensemble des severities PrimeNG utilisées ici (cf. `p-tag` de l'étape Documents).
 */
export type RegistrationStatusSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

/**
 * Statut tel qu'affiché dans « Mon Espace ».
 *
 * `not-started` n'existe pas côté back : il traduit l'absence de Registration pour l'édition
 * active, le brouillon n'étant créé qu'au premier accès au formulaire (get-or-create de
 * `/registrations/by-edition-year/{year}`).
 */
export type DisplayRegistrationStatus = RegistrationStatus | 'not-started';

const LABELS: Record<DisplayRegistrationStatus, string> = {
  'not-started': 'Pas commencée',
  draft: 'Brouillon',
  submitted: 'Envoyée — en cours d\'étude',
  accepted: 'Acceptée',
  waitlisted: 'Liste d\'attente',
  refused: 'Refusée',
  confirmed: 'Confirmée',
  completed: 'Terminée',
};

const SEVERITIES: Record<DisplayRegistrationStatus, RegistrationStatusSeverity> = {
  'not-started': 'secondary',
  draft: 'info',
  submitted: 'info',
  accepted: 'success',
  waitlisted: 'warn',
  refused: 'danger',
  confirmed: 'success',
  completed: 'success',
};

export function statusLabel(status: DisplayRegistrationStatus): string {
  return LABELS[status];
}

export function statusSeverity(status: DisplayRegistrationStatus): RegistrationStatusSeverity {
  return SEVERITIES[status];
}
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `npm run build`
Expected: build réussi, aucune erreur TypeScript. Le fichier n'est encore importé nulle part, on vérifie seulement qu'il compile et que les `Record` sont exhaustifs (une clé manquante ferait échouer le build).

- [ ] **Step 3 : Commit**

```bash
git add src/app/core/utils/registration-status.util.ts
git commit -m "feat(mon-espace): ajoute les libelles et severities de statut d'inscription"
```

---

### Task 2 : Carte de la demande active

**Files:**
- Create: `src/app/dashboard/components/active-registration-card/active-registration-card.component.ts`
- Create: `src/app/dashboard/components/active-registration-card/active-registration-card.component.html`

**Interfaces:**
- Consumes: `statusLabel`, `statusSeverity`, `DisplayRegistrationStatus`, `RegistrationStatusSeverity` (Task 1) ; `RegistrationSummary` depuis `@app/core/models/registration.model` (champs : `id`, `edition`, `status`, `refusalComment`) ; `Edition` depuis `@app/shared/models/edition.interface` (champs utilisés : `year`, `isActive`, `registrationOpen`, `isVisible`).
- Produces: `ActiveRegistrationCardComponent`, sélecteur `app-active-registration-card`, entrées `edition: Edition | null` et `registration: RegistrationSummary | null`, sortie `consult: OutputEmitterRef<void>`. La Task 4 le consomme.

- [ ] **Step 1 : Créer le composant TypeScript**

Créer `src/app/dashboard/components/active-registration-card/active-registration-card.component.ts` :

```ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { RegistrationSummary } from '@app/core/models/registration.model';
import { Edition } from '@app/shared/models/edition.interface';
import {
  DisplayRegistrationStatus,
  RegistrationStatusSeverity,
  statusLabel,
  statusSeverity,
} from '@app/core/utils/registration-status.util';

/**
 * Carte de la demande d'inscription pour l'édition active.
 *
 * Composant de présentation pur : il ne charge rien et ne navigue pas lui-même. La page lui
 * passe l'édition active et l'inscription correspondante — `null` si l'exposant n'a jamais
 * ouvert le formulaire — et écoute `consult` pour déclencher la navigation.
 */
@Component({
  selector: 'app-active-registration-card',
  standalone: true,
  imports: [ButtonModule, Card, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './active-registration-card.component.html',
})
export class ActiveRegistrationCardComponent {
  readonly edition = input.required<Edition | null>();
  readonly registration = input.required<RegistrationSummary | null>();

  /** Émis quand l'exposant veut ouvrir le formulaire de l'édition active. */
  readonly consult = output<void>();

  protected readonly status = computed<DisplayRegistrationStatus>(
    () => this.registration()?.status ?? 'not-started',
  );

  protected readonly label = computed<string>(() => statusLabel(this.status()));

  protected readonly severity = computed<RegistrationStatusSeverity>(() =>
    statusSeverity(this.status()),
  );

  /**
   * Libellé du bouton, ou `null` quand aucun bouton ne doit s'afficher.
   *
   * Deux garde-fous dictés par le comportement réel de l'API :
   * - une édition masquée par HA (`isVisible = false`) renvoie un 404 sur
   *   `/registrations/by-edition-year/{year}` — on n'y envoie personne ;
   * - tant qu'aucune Registration n'existe, le get-or-create répond 403 si les inscriptions
   *   sont fermées — le bouton « Commencer » n'a donc de sens que si `registrationOpen`.
   */
  protected readonly actionLabel = computed<string | null>(() => {
    const edition = this.edition();
    if (!edition || !edition.isVisible) {
      return null;
    }

    const registration = this.registration();
    if (registration === null) {
      return edition.registrationOpen ? 'Commencer mon inscription' : null;
    }

    switch (registration.status) {
      case 'draft':
        return 'Reprendre mon formulaire';
      case 'submitted':
      case 'waitlisted':
      case 'refused':
        return 'Consulter mon dossier';
      default:
        return 'Accéder à mon dossier';
    }
  });

  /** Phrase indiquant la prochaine action attendue, ou `null` si le statut n'en appelle aucune. */
  protected readonly message = computed<string | null>(() => {
    const edition = this.edition();
    if (!edition) {
      return null;
    }

    const registration = this.registration();
    if (registration === null) {
      return edition.registrationOpen
        ? `Les inscriptions sont ouvertes pour l'édition ${edition.year}.`
        : null;
    }

    switch (registration.status) {
      case 'draft':
        return 'Votre formulaire est enregistré mais pas encore envoyé.';
      case 'submitted':
        return 'Nous étudions votre demande. Vous serez notifié par email.';
      case 'accepted':
        return 'Votre demande est acceptée — il reste à confirmer votre participation et signer votre devis.';
      case 'confirmed':
      case 'completed':
        return 'Votre inscription est confirmée.';
      default:
        return null;
    }
  });

  /**
   * Commentaire saisi par HA au refus ou à la mise en liste d'attente (cf. cahier des charges,
   * STEP 3). Volontairement borné à ces deux statuts : `refusalComment` n'a pas de sens ailleurs.
   */
  protected readonly refusalComment = computed<string | null>(() => {
    const registration = this.registration();
    if (registration === null) {
      return null;
    }

    return registration.status === 'refused' || registration.status === 'waitlisted'
      ? registration.refusalComment
      : null;
  });

  protected readonly isRefused = computed<boolean>(
    () => this.registration()?.status === 'refused',
  );

  protected readonly registrationsClosed = computed<boolean>(() => {
    const edition = this.edition();
    return edition !== null && (!edition.isVisible || !edition.registrationOpen);
  });
}
```

- [ ] **Step 2 : Créer le template**

Créer `src/app/dashboard/components/active-registration-card/active-registration-card.component.html` :

```html
@if (edition(); as activeEdition) {
  <p-card>
    <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
      <h2 class="font-serif font-semibold text-xl text-[#1A1714] m-0">
        Édition {{ activeEdition.year }}
      </h2>
      <p-tag [severity]="severity()" [value]="label()" />
    </div>

    @if (message(); as text) {
      <p class="auth-subheading !mb-4">{{ text }}</p>
    }

    @if (refusalComment(); as comment) {
      <div class="auth-error-banner">{{ comment }}</div>
    }

    @if (isRefused()) {
      <p class="auth-subheading !mb-4">Vous conservez votre espace et vos données.</p>
    }

    @if (registrationsClosed()) {
      <p class="auth-subheading !mb-4">Les inscriptions ne sont pas ouvertes pour le moment.</p>
    }

    @if (actionLabel(); as action) {
      <p-button
        [label]="action"
        severity="primary"
        size="small"
        (onClick)="consult.emit()"
      />
    }
  </p-card>
} @else {
  <p class="auth-subheading">Aucune édition n'est ouverte actuellement.</p>
}
```

- [ ] **Step 3 : Vérifier la compilation**

Run: `npm run build`
Expected: build réussi. Le composant n'est pas encore monté dans une page ; ce build valide surtout que `strictTemplates` accepte les liaisons `[severity]` et `[value]` de `p-tag`.

Si le build échoue sur `[severity]` avec un message de type incompatible, c'est que le type `severity` de `p-tag` de cette version de PrimeNG diffère : alors — et seulement alors — élargir `RegistrationStatusSeverity` dans `registration-status.util.ts` pour couvrir la valeur attendue par PrimeNG, sans changer les valeurs de la table `SEVERITIES`.

- [ ] **Step 4 : Commit**

```bash
git add src/app/dashboard/components/active-registration-card
git commit -m "feat(mon-espace): ajoute la carte de la demande de l'edition active"
```

---

### Task 3 : Liste des éditions précédentes

**Files:**
- Create: `src/app/dashboard/components/past-registrations-list/past-registrations-list.component.ts`
- Create: `src/app/dashboard/components/past-registrations-list/past-registrations-list.component.html`

**Interfaces:**
- Consumes: `statusLabel`, `statusSeverity` (Task 1) ; `RegistrationSummary` depuis `@app/core/models/registration.model`.
- Produces: `PastRegistrationsListComponent`, sélecteur `app-past-registrations-list`, entrée `registrations: RegistrationSummary[]`, sortie `consult: OutputEmitterRef<string>` qui émet **l'année** de l'édition à consulter (ex. `"2028"`). La Task 4 le consomme.

- [ ] **Step 1 : Créer le composant TypeScript**

Créer `src/app/dashboard/components/past-registrations-list/past-registrations-list.component.ts` :

```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { RegistrationSummary } from '@app/core/models/registration.model';
import { statusLabel, statusSeverity } from '@app/core/utils/registration-status.util';

/**
 * Historique des éditions auxquelles l'exposant a déjà participé.
 *
 * Composant de présentation pur. Le tri est de la responsabilité de l'appelant : la page envoie
 * la liste déjà ordonnée par année décroissante.
 */
@Component({
  selector: 'app-past-registrations-list',
  standalone: true,
  imports: [ButtonModule, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './past-registrations-list.component.html',
})
export class PastRegistrationsListComponent {
  readonly registrations = input.required<RegistrationSummary[]>();

  /** Émet l'année de l'édition que l'exposant veut consulter. */
  readonly consult = output<string>();

  protected readonly statusLabel = statusLabel;
  protected readonly statusSeverity = statusSeverity;
}
```

- [ ] **Step 2 : Créer le template**

Créer `src/app/dashboard/components/past-registrations-list/past-registrations-list.component.html` :

```html
@if (registrations().length > 0) {
  <section class="mt-8">
    <h2 class="font-serif font-semibold text-lg text-[#1A1714] mb-3">
      Mes éditions précédentes
    </h2>

    <ul class="list-none m-0 p-0 border-t border-[#D4C9A8]">
      @for (registration of registrations(); track registration.id) {
        <li
          class="flex items-center justify-between gap-3 flex-wrap py-3 border-b border-[#D4C9A8]"
        >
          <span class="flex items-center gap-3">
            <span class="font-semibold text-[#1A1714]">
              Édition {{ registration.edition.year }}
            </span>
            <p-tag
              [severity]="statusSeverity(registration.status)"
              [value]="statusLabel(registration.status)"
            />
          </span>

          <p-button
            label="Consulter"
            severity="primary"
            text
            size="small"
            (onClick)="consult.emit(registration.edition.year)"
          />
        </li>
      }
    </ul>
  </section>
}
```

- [ ] **Step 3 : Vérifier la compilation**

Run: `npm run build`
Expected: build réussi.

- [ ] **Step 4 : Commit**

```bash
git add src/app/dashboard/components/past-registrations-list
git commit -m "feat(mon-espace): ajoute la liste des editions precedentes"
```

---

### Task 4 : Recâbler la page Mon Espace

Cette tâche remplace intégralement le contenu de la page, ajoute `contactEmail` aux deux fichiers d'environnement et supprime les deux navigations vers des routes inexistantes (`/mon-espace/historique/:id` et `/mon-espace/contact`).

**Files:**
- Modify: `src/environments/environment.ts`
- Modify: `src/environments/environment.development.ts`
- Modify: `src/app/dashboard/page/mon-espace-home/mon-espace-home.component.ts` *(réécriture complète)*
- Modify: `src/app/dashboard/page/mon-espace-home/mon-espace-home.component.html` *(réécriture complète)*

**Interfaces:**
- Consumes: `ActiveRegistrationCardComponent` (Task 2) et `PastRegistrationsListComponent` (Task 3) ; `RegistrationService.getMine()` qui renvoie `Observable<ApiResponse<RegistrationSummary[]>>` ; `EditionService.getActive()` qui renvoie `Observable<ApiResponse<Edition>>`.
- Produces: rien pour les tâches suivantes.

- [ ] **Step 1 : Ajouter `contactEmail` aux deux environnements**

Remplacer le contenu de `src/environments/environment.ts` :

```ts
export const environment = {
  apiUrl: 'http://localhost:8000/api',
  contactEmail: 'info@historic-auto.com',
};
```

Remplacer le contenu de `src/environments/environment.development.ts` :

```ts
export const environment = {
  apiUrl: 'http://localhost:8000/api',
  contactEmail: 'info@historic-auto.com',
};
```

- [ ] **Step 2 : Réécrire le composant TypeScript**

Remplacer intégralement `src/app/dashboard/page/mon-espace-home/mon-espace-home.component.ts` :

```ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { RegistrationSummary } from '@app/core/models/registration.model';
import { Edition } from '@app/shared/models/edition.interface';
import { EditionService } from '@app/shared/services/edition.service';
import { RegistrationService } from '@app/shared/services/registration.service';
import {
  ActiveRegistrationCardComponent,
} from '@app/dashboard/components/active-registration-card/active-registration-card.component';
import {
  PastRegistrationsListComponent,
} from '@app/dashboard/components/past-registrations-list/past-registrations-list.component';
import { environment } from '../../../../environments/environment';

/**
 * Point d'entrée de l'espace exposant.
 *
 * Seul composant de la page à charger des données : il calcule la demande de l'édition active
 * et l'historique, puis délègue tout l'affichage à deux composants de présentation.
 */
@Component({
  selector: 'app-mon-espace-home',
  standalone: true,
  imports: [ActiveRegistrationCardComponent, PastRegistrationsListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mon-espace-home.component.html',
})
export class MonEspaceHomeComponent {
  private readonly registrationService = inject(RegistrationService);
  private readonly editionService = inject(EditionService);
  private readonly router = inject(Router);

  private readonly registrations = signal<RegistrationSummary[]>([]);

  protected readonly loading = signal(true);
  protected readonly activeEdition = signal<Edition | null>(null);
  protected readonly contactEmail = environment.contactEmail;

  protected readonly currentRegistration = computed<RegistrationSummary | null>(
    () => this.registrations().find((registration) => registration.edition.isActive) ?? null,
  );

  /**
   * `findByExhibitor` trie les éditions par année croissante côté back ; l'historique se lit de
   * la plus récente à la plus ancienne, d'où le tri inverse ici plutôt qu'une modification de
   * l'API. `filter` renvoyant déjà un nouveau tableau, `sort` ne mute pas le signal.
   */
  protected readonly pastRegistrations = computed<RegistrationSummary[]>(() =>
    this.registrations()
      .filter((registration) => !registration.edition.isActive)
      .sort((a, b) => b.edition.year.localeCompare(a.edition.year)),
  );

  constructor() {
    forkJoin({
      mineResp: this.registrationService.getMine(),
      activeEditionResp: this.editionService.getActive(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ mineResp, activeEditionResp }) => {
        this.registrations.set(mineResp.data);
        this.activeEdition.set(activeEditionResp.data);
      });
  }

  protected goToEdition(year: string): void {
    void this.router.navigate(['/edition', year]);
  }

  protected goToActiveEdition(): void {
    const edition = this.activeEdition();
    if (edition !== null) {
      this.goToEdition(edition.year);
    }
  }
}
```

- [ ] **Step 3 : Réécrire le template**

Remplacer intégralement `src/app/dashboard/page/mon-espace-home/mon-espace-home.component.html` :

```html
<div class="auth-shell !min-h-100! p-0 items-start justify-start">
  <div class="w-full max-w-3xl mx-auto px-4 py-8 sm:py-10">

    <header class="flex items-center justify-between gap-3 flex-wrap mb-8">
      <h1 class="font-serif font-semibold text-2xl sm:text-[2.2rem] text-[#1A1714]">
        Mon Espace
      </h1>

      <a
        class="inline-flex items-center gap-2 text-sm font-semibold no-underline text-[#B8860B] hover:text-[#9A7009]"
        [href]="'mailto:' + contactEmail"
      >
        <i class="pi pi-envelope"></i>
        Nous contacter
      </a>
    </header>

    @if (loading()) {
      <p class="auth-subheading">Chargement de vos éditions…</p>
    } @else {
      <app-active-registration-card
        [edition]="activeEdition()"
        [registration]="currentRegistration()"
        (consult)="goToActiveEdition()"
      />

      <app-past-registrations-list
        [registrations]="pastRegistrations()"
        (consult)="goToEdition($event)"
      />
    }

  </div>
</div>
```

- [ ] **Step 4 : Vérifier qu'aucune route morte ne subsiste**

Run: `grep -rn "mon-espace/historique\|mon-espace/contact" src`
Expected: aucune ligne retournée. Si une ligne sort, supprimer la navigation correspondante.

- [ ] **Step 5 : Vérifier la compilation**

Run: `npm run build`
Expected: build réussi, aucune erreur.

- [ ] **Step 6 : Commit**

```bash
git add src/environments src/app/dashboard/page/mon-espace-home
git commit -m "feat(mon-espace): affiche le statut de la demande active et l'historique"
```

---

### Task 5 : Protéger la route du formulaire

**Files:**
- Modify: `src/app/dashboard/dashboard.routes.ts`

**Interfaces:**
- Consumes: `authGuard` depuis `@app/core/guards/auth.guard` — déjà importé dans ce fichier pour la route `dashboard`.
- Produces: rien.

- [ ] **Step 1 : Ajouter la garde**

Dans `src/app/dashboard/dashboard.routes.ts`, remplacer le bloc de la route `edition/:year` :

```ts
  {
    path: 'edition/:year',
    loadComponent: () => import('./page/edition-form/edition-form-page.component').then((m) => m.EditionFormPageComponent),
    providers: [EditionFormStateService],
  },
```

par :

```ts
  {
    path: 'edition/:year',
    loadComponent: () => import('./page/edition-form/edition-form-page.component').then((m) => m.EditionFormPageComponent),
    canActivate: [authGuard],
    providers: [EditionFormStateService],
  },
```

L'import `authGuard` est déjà présent en haut du fichier et le tableau `providers` reste inchangé — `EditionFormStateService` doit rester porté par la route pour que chaque visite du formulaire reparte d'un état neuf.

- [ ] **Step 2 : Vérifier la compilation**

Run: `npm run build`
Expected: build réussi.

- [ ] **Step 3 : Commit**

```bash
git add src/app/dashboard/dashboard.routes.ts
git commit -m "fix(dashboard): protege la route du formulaire d'inscription par authGuard"
```

---

## Vérification finale (après la Task 5)

- [ ] **Step 1 : Lancer le front**

Démarrer le serveur de développement via l'outil de preview (jamais via un `npm start` en tâche de fond) avec une entrée `.claude/launch.json` : `runtimeExecutable: "npm"`, `runtimeArgs: ["start"]`, `port: 4200`.

- [ ] **Step 2 : Contrôler la console et le réseau**

Vérifier qu'aucune erreur de console n'apparaît au chargement de `/dashboard` et que `GET /api/registrations/mine` et `GET /api/editions/active` répondent bien en 200.

- [ ] **Step 3 : Contrôler les états à l'écran**

Sur `/dashboard`, connecté en exposant :

1. La carte du haut affiche « Édition {année} » avec un `p-tag` de statut et un bouton.
2. La section « Mes éditions précédentes » apparaît sous la carte, années en ordre décroissant, avec un lien « Consulter » par ligne.
3. Cliquer « Consulter » sur une ancienne édition ouvre `/edition/{année}` avec la bannière « Édition passée — affiché à titre d'historique ».
4. Le lien « Nous contacter » ouvre bien un `mailto:info@historic-auto.com`.

- [ ] **Step 4 : Contrôler la garde de route**

Se déconnecter puis ouvrir `/edition/2030` directement dans la barre d'adresse.
Expected: redirection vers `/login`, pas de 401 dans la console.

- [ ] **Step 5 : Prendre une capture d'écran de `/dashboard` et la présenter**

Pour que l'état final soit constaté, pas seulement affirmé.

---

## Notes pour l'exécutant

**Les états difficiles à voir en local.** « Pas commencée » se reproduit avec un compte exposant qui n'a jamais ouvert le formulaire de l'édition active. « Refusée » demande de passer la Registration en `refused` avec un `refusalComment` en base. Si ces deux états ne sont pas reproductibles sur le jeu de données local, le signaler dans le compte rendu plutôt que de prétendre les avoir vérifiés — le build et la relecture du code couvrent le reste.

**Une fragilité préexistante à ne pas « corriger » au passage.** Le `forkJoin` échoue en bloc : si `GET /api/editions/active` tombe en erreur, `registrations` reste vide et l'historique disparaît aussi. C'est le comportement actuel, il n'est pas aggravé par ce chantier — le laisser tel quel et le signaler dans le compte rendu plutôt que d'élargir le périmètre.

**Ce qu'il ne faut pas faire.** Ne pas toucher au back. Ne pas modifier `EditionFormStateService` ni le wizard `/edition/:year` : son mode lecture seule pour les éditions passées fonctionne déjà. Ne pas ajouter de tests automatisés.
