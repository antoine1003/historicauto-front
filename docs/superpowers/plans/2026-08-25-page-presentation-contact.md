# Page de présentation et page de contact — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter le front exposant d'une page de présentation sur `/` et d'une page de contact sur `/contact`, toutes deux enveloppées dans une coquille publique (en-tête + pied de page), sans toucher aux parcours existants.

**Architecture :** Un nouveau feature folder `src/app/public/` aligné sur `core/` et `dashboard/`. Un `PublicLayoutComponent` assemble en-tête, `<router-outlet>` et pied de page ; l'en-tête est le seul composant de la coquille à porter de la logique (choix du CTA d'après `AuthService`). Les deux pages sont montées en `loadComponent` sous un parent de chemin `''`. Le formulaire de contact est isolé derrière un `ContactService` dont la seule méthode simule aujourd'hui la réponse du back.

**Tech Stack :** Angular 21 standalone + signals + control flow `@if`/`@for`, PrimeNG 21 (preset `HistoricAutoPreset`), Tailwind 4 via `@apply` dans un fichier de thème dédié, TypeScript strict (`strict`, `strictTemplates`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`).

**Spec de référence :** `docs/superpowers/specs/2026-08-25-page-presentation-contact-design.md`

## Global Constraints

- **Pas de tests automatisés.** Ce projet n'en écrit pas. Chaque tâche se termine par une vérification manuelle : `npx ng build` puis contrôle navigateur. Ne créez aucun `*.spec.ts`.
- **Aucune dépendance npm nouvelle.** Tout est faisable avec ce qui est déjà installé.
- **Jetons de charte, valeurs exactes, aucune autre couleur :** crème `#F7F5F0`, or `#B8860B`, or survolé `#9A7009`, or clair `#DCB54C`, sable `#D4C9A8`, sable foncé `#EFEADD`, encre `#1A1714`, gris `#6B6560`, gris clair `#C9C2B8`, blanc cassé `#FAFAF7`, placeholder `#B5AEA4`.
- **Angles :** `rounded-sm` partout, jamais `rounded-md` ou plus.
- **Typographie :** `font-serif` (Cormorant Garamond) pour tous les titres, sans-serif (DM Sans) pour le corps. Les deux polices sont déjà chargées par `src/index.html`.
- **Signature visuelle des blocs saillants :** `border border-[#D4C9A8] border-l-4 border-l-[#B8860B]`, comme `.auth-card`.
- **Classes existantes à réutiliser sans les redéfinir :** `.auth-logo-mark`, `.auth-logo-text`, `.auth-btn-primary`, `.auth-link`, `.auth-input`, `.auth-input--error`, `.auth-field`, `.auth-label`, `.auth-field-error`, `.auth-error-banner`. Elles vivent dans `src/app/core/styles/auth.theme.css` — ne pas les modifier.
- **Écart assumé par rapport au spec :** `.auth-btn-primary` est `w-full h-[54px]`, donc inutilisable pour les boutons en ligne de l'en-tête et du hero. Une famille `.ha-btn` / `.ha-btn--primary` / `.ha-btn--ghost` est créée pour ces cas. `.auth-btn-primary` reste utilisée telle quelle pour le bouton d'envoi du formulaire de contact, qui est bien pleine largeur.
- **Faits sur le salon — n'en inventez aucun autre :** 6e édition, février 2028, Parc des Expositions de Nantes, salon du véhicule de collection, 40 000 visiteurs, 330 exposants, 27 000 m², 30 expositions thématiques, `info@historic-auto.com`, HISTORIC AUTO / 5 bis avenue de l'Europe / 44260 La Montagne, site officiel `https://www.historic-auto.com`. Aucun tarif, aucune date limite, aucun horaire, aucun numéro de téléphone : ces informations n'ont pas de source.
- **Adresse email :** toujours via `environment.contactEmail`, jamais en dur.
- **Serveur de vérification :** configuration `front-main` de `HistoricAuto/.claude/launch.json`, port 4200. **Ne pas utiliser `frontend-dev` (port 4201)** : elle pointe vers le worktree obsolète `registration-form-frontend-integration`. Si le chantier est mené dans un worktree dédié, ajoutez-y une nouvelle configuration plutôt que d'en réutiliser une.
- **Worktree :** le chantier se mène dans `historicauto-front/.claude/worktrees/public-landing-contact`, branche `worktree-public-landing-contact`, déjà créée et dépendances déjà installées. Ne commitez jamais sur `main`.
- **Baseline mesurée le 2026-08-25**, avant toute modification : `npx ng build` réussit en produisant **deux avertissements de budget préexistants** — `bundle initial exceeded maximum budget` (773,55 kB pour un budget de 500 kB) et `src/app/core/styles/edition-form.theme.css exceeded maximum budget` (7,98 kB pour un budget de 4 kB). Ces deux avertissements ne sont pas de votre fait et ne doivent pas être « corrigés ». Le seuil d'**erreur** `anyComponentStyle` est à 8 kB : `edition-form.theme.css` en est très proche, ne l'alourdissez pas.
- **Impact mesuré du thème public :** l'ajout de `public.theme.css` (6,1 kB de source) ne crée aucun nouvel avertissement de budget ; il fait seulement passer le dépassement du bundle initial de 273,55 kB à 288,41 kB. C'est attendu.

## Structure de fichiers

| Fichier | Responsabilité |
|---|---|
| `src/app/core/styles/public.theme.css` | **Créé.** Toutes les classes `.ha-*`. Seul endroit où vivent les styles publics. |
| `src/styles.scss` | **Modifié.** Ajout de l'import du thème public dans `@layer components`. |
| `src/index.html` | **Modifié.** `lang="fr"` et titre par défaut. |
| `src/app/public/public.routes.ts` | **Créé.** Déclare `PUBLIC_ROUTES`. |
| `src/app/app.routes.ts` | **Modifié.** Branche `PUBLIC_ROUTES` en tête et ajoute le `**`. |
| `src/app/public/layout/public-layout.component.ts` | **Créé.** Assemble en-tête, outlet, pied de page. Aucune logique. |
| `src/app/public/layout/public-header.component.ts` + `.html` | **Créé.** Marque, nav, CTA contextuel, menu mobile. |
| `src/app/public/layout/public-footer.component.ts` | **Créé.** Coordonnées et liens. Template inline. |
| `src/app/public/pages/home/home.component.ts` + `.html` | **Créé.** Page d'accueil, présentationnel. |
| `src/app/public/pages/contact/contact.component.ts` + `.html` | **Créé.** Formulaire, validation, trois états. |
| `src/app/public/models/contact.model.ts` | **Créé.** `ContactSubject`, `ContactRequest`. |
| `src/app/public/services/contact.service.ts` | **Créé.** Unique frontière réseau du formulaire. |
| `public/images/.gitkeep` | **Créé.** Dossier d'accueil des photos à venir. |

---

### Task 1 : Coquille publique et routage

Cette tâche lève le seul risque structurel du chantier avant d'écrire la moindre ligne de contenu : `PUBLIC_ROUTES` et `AUTH_ROUTES` déclarent tous deux un parent de chemin `''`, et il faut vérifier qu'Angular rebrousse bien chemin pour continuer à résoudre `/login`.

> **Les steps 1 et 2 sont déjà faits** — ils ont été exécutés pour mesurer l'impact du thème sur les budgets de build. `src/app/core/styles/public.theme.css` existe avec le contenu exact ci-dessous et `src/styles.scss` l'importe déjà. Vérifiez-le et passez au step 3 ; ne réécrivez pas ces fichiers.

**Files:**
- Create: `src/app/core/styles/public.theme.css`
- Create: `src/app/public/public.routes.ts`
- Create: `src/app/public/layout/public-layout.component.ts`
- Create: `src/app/public/layout/public-header.component.ts`
- Create: `src/app/public/layout/public-header.component.html`
- Create: `src/app/public/layout/public-footer.component.ts`
- Create: `src/app/public/pages/home/home.component.ts`
- Create: `src/app/public/pages/home/home.component.html`
- Create: `src/app/public/pages/contact/contact.component.ts`
- Create: `src/app/public/pages/contact/contact.component.html`
- Create: `public/images/.gitkeep`
- Modify: `src/styles.scss`
- Modify: `src/index.html`
- Modify: `src/app/app.routes.ts`

**Interfaces:**
- Consumes : `AuthService` (`isInitialized(): Signal<boolean>`, `isAuthenticated(): Signal<boolean>`, `currentUser(): Signal<AuthUser | null>`) depuis `@app/core/services/auth.service` ; `environment.contactEmail: string`.
- Produces : `PUBLIC_ROUTES: Routes`, `PublicLayoutComponent`, `PublicHeaderComponent` (sélecteur `app-public-header`), `PublicFooterComponent` (sélecteur `app-public-footer`), `HomeComponent` (sélecteur `app-home`), `ContactComponent` (sélecteur `app-contact`). Les classes CSS `.ha-*` listées à l'étape 1 sont consommées par les Tasks 2 à 5.

- [ ] **Step 1 : Créer le thème public**

Créer `src/app/core/styles/public.theme.css`. Ce fichier contient l'intégralité des classes utilisées par les Tasks 1 à 5 — écrivez-le en entier maintenant, les tâches suivantes n'y reviendront pas.

```css
/* src/app/core/styles/public.theme.css */
@reference "tailwindcss";

/* ── Coquille ── */

.ha-shell {
  @apply min-h-screen flex flex-col bg-[#F7F5F0] text-[#1A1714];
}

.ha-main {
  @apply flex-1;
}

.ha-container {
  @apply w-full max-w-5xl mx-auto px-5 sm:px-8;
}

/* ── En-tête ── */

.ha-header {
  @apply sticky top-0 z-30 bg-[#F7F5F0] border-b border-[#D4C9A8];
}

.ha-header-inner {
  @apply flex items-center justify-between gap-4 h-[72px];
}

.ha-brand {
  @apply flex items-center gap-3 no-underline;
}

.ha-nav {
  @apply hidden md:flex items-center gap-7;
}

.ha-nav-link {
  @apply text-[0.95rem] no-underline text-[#6B6560] hover:text-[#1A1714] transition-colors;
}

.ha-nav-link--active {
  @apply text-[#1A1714] font-semibold;
}

.ha-header-actions {
  @apply hidden md:flex items-center gap-5;
}

.ha-burger {
  @apply md:hidden w-10 h-10 flex items-center justify-center
  bg-transparent border border-[#D4C9A8] rounded-sm text-[#1A1714] cursor-pointer;
}

.ha-mobile-menu {
  @apply md:hidden flex flex-col items-start gap-4 border-t border-[#D4C9A8] py-5;
}

/* ── Boutons ── */

.ha-btn {
  @apply inline-flex items-center justify-center h-[44px] px-5
  text-[0.95rem] font-semibold tracking-wide rounded-sm
  no-underline cursor-pointer transition-colors;
}

.ha-btn--primary {
  @apply bg-[#B8860B] hover:bg-[#9A7009] text-white border-none;
}

.ha-btn--ghost {
  @apply bg-transparent text-[#B8860B] border border-[#B8860B] hover:bg-[#B8860B]/10;
}

/* ── Sections ── */

.ha-section {
  @apply py-14 sm:py-16;
}

.ha-eyebrow {
  @apply text-[0.78rem] font-semibold uppercase tracking-[0.22em] text-[#B8860B] mb-4;
}

.ha-h1 {
  @apply font-serif font-semibold text-[2.6rem] sm:text-[3.4rem] leading-[1.08] text-[#1A1714] mb-5;
}

.ha-lead {
  @apply text-[1.05rem] leading-relaxed text-[#6B6560] mb-8 max-w-xl;
}

.ha-section-title {
  @apply font-serif font-semibold text-[2rem] sm:text-[2.4rem] leading-tight text-[#1A1714] mb-3;
}

.ha-section-lead {
  @apply text-[1rem] leading-relaxed text-[#6B6560] mb-10 max-w-2xl;
}

/* ── Hero ── */

.ha-hero {
  @apply py-14 sm:py-20 grid gap-10 md:grid-cols-[1.15fr_1fr] md:items-center;
}

.ha-hero-actions {
  @apply flex flex-wrap items-center gap-6;
}

/* ── Bandeau salon ── */

.ha-band {
  @apply border-y border-[#D4C9A8] bg-[#FAFAF7];
}

.ha-band-meta {
  @apply flex flex-wrap items-center justify-center gap-x-3 gap-y-1
  py-8 text-[0.95rem] text-[#6B6560] text-center;
}

.ha-band-meta-strong {
  @apply font-serif font-semibold text-[1.15rem] text-[#1A1714];
}

.ha-stats {
  @apply grid grid-cols-2 md:grid-cols-4 gap-4 pb-12;
}

.ha-stat {
  @apply bg-white border border-[#D4C9A8] border-l-4 border-l-[#B8860B] px-4 py-6 text-center;
}

.ha-stat-value {
  @apply font-serif font-semibold text-[2rem] leading-none text-[#1A1714] mb-2;
}

.ha-stat-label {
  @apply text-[0.8rem] uppercase tracking-[0.12em] text-[#6B6560];
}

/* ── Emplacements image ── */

.ha-image-slot {
  @apply w-full flex flex-col items-center justify-center gap-2 text-center
  bg-[#EFEADD] border border-[#D4C9A8] border-l-4 border-l-[#B8860B] text-[#6B6560];
}

.ha-image-slot--hero {
  @apply aspect-[4/3];
}

.ha-image-slot--band {
  @apply aspect-[3/1];
}

.ha-image-slot-label {
  @apply text-[0.85rem] font-semibold text-[#1A1714];
}

.ha-image-slot-hint {
  @apply text-[0.75rem];
}

/* ── Étapes ── */

.ha-steps {
  @apply grid gap-5 sm:grid-cols-2 lg:grid-cols-3;
}

.ha-step {
  @apply bg-white border border-[#D4C9A8] border-l-4 border-l-[#B8860B] px-6 py-6;
}

.ha-step-index {
  @apply block font-serif font-semibold text-[1.1rem] text-[#B8860B] mb-2;
}

.ha-step-title {
  @apply font-serif font-semibold text-[1.3rem] text-[#1A1714] mb-2;
}

.ha-step-text {
  @apply text-[0.95rem] leading-relaxed text-[#6B6560];
}

/* ── Appel à l'action de clôture ── */

.ha-cta {
  @apply bg-[#1A1714] text-[#F7F5F0] px-8 py-12 sm:px-14 sm:py-16 text-center;
}

.ha-cta-title {
  @apply font-serif font-semibold text-[2rem] sm:text-[2.4rem] leading-tight mb-4;
}

.ha-cta-text {
  @apply text-[1rem] leading-relaxed text-[#C9C2B8] mb-8 max-w-xl mx-auto;
}

.ha-cta-link {
  @apply text-[#DCB54C] font-semibold no-underline hover:underline;
}

/* ── Pied de page ── */

.ha-footer {
  @apply border-t border-[#D4C9A8] bg-[#FAFAF7];
}

.ha-footer-grid {
  @apply grid gap-8 sm:grid-cols-3 py-12;
}

.ha-footer-title {
  @apply text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[#B8860B] mb-3;
}

.ha-footer-text {
  @apply text-[0.9rem] leading-relaxed text-[#6B6560] not-italic;
}

.ha-footer-link {
  @apply block text-[0.9rem] no-underline text-[#6B6560] hover:text-[#B8860B] transition-colors py-0.5;
}

.ha-footer-bottom {
  @apply border-t border-[#D4C9A8] py-5 text-[0.82rem] text-[#6B6560] text-center;
}

/* ── Page de contact ── */

.ha-contact-grid {
  @apply grid gap-10 lg:grid-cols-[1.6fr_1fr] items-start;
}

.ha-panel {
  @apply bg-white border border-[#D4C9A8] border-l-4 border-l-[#B8860B] px-6 py-7 sm:px-8 sm:py-8;
}

.ha-identity {
  @apply flex items-center gap-3 bg-[#FAFAF7] border border-[#D4C9A8] rounded-sm
  px-4 py-3 mb-5 text-[0.9rem] text-[#6B6560];
}

.ha-identity-name {
  @apply font-semibold text-[#1A1714];
}

.ha-textarea {
  @apply w-full min-h-[160px] px-4 py-3 text-base
  border-[1.5px] border-[#D4C9A8]
  bg-[#FAFAF7] text-[#1A1714]
  placeholder-[#B5AEA4]
  focus:outline-none focus:border-[#B8860B] focus:bg-white
  rounded-sm transition-colors resize-y;
}

.ha-success {
  @apply flex flex-col items-center text-center py-6;
}

.ha-success-icon {
  @apply w-14 h-14 rounded-full flex items-center justify-center
  bg-[#B8860B]/10 border border-[#B8860B] text-[#B8860B] text-2xl mb-5;
}

.ha-aside {
  @apply flex flex-col gap-7;
}

.ha-aside-title {
  @apply text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[#B8860B] mb-2;
}

.ha-aside-text {
  @apply text-[0.95rem] leading-relaxed text-[#6B6560] not-italic;
}
```

- [ ] **Step 2 : Importer le thème public**

Modifier `src/styles.scss`. Le bloc `@layer components` existant devient :

```scss
@layer components {
  @import './app/core/styles/auth.theme.css';
  @import './app/core/styles/edition-form.theme.css';
  @import './app/core/styles/public.theme.css';
}
```

Ne touchez à rien d'autre dans ce fichier.

- [ ] **Step 3 : Corriger la langue et le titre par défaut**

Modifier `src/index.html` : remplacer `<html lang="en">` par `<html lang="fr">` et `<title>HistoricautoFront</title>` par `<title>Historic Auto — Espace exposant</title>`. L'application est entièrement en français et `/` devient une page publique ; ces deux valeurs sont visibles avant que le routeur n'applique le titre de route.

- [ ] **Step 4 : Créer le pied de page**

Créer `src/app/public/layout/public-footer.component.ts` :

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-public-footer',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="ha-footer">
      <div class="ha-container">
        <div class="ha-footer-grid">
          <div>
            <p class="ha-footer-title">Historic Auto</p>
            <address class="ha-footer-text">
              5 bis avenue de l'Europe<br />
              44260 La Montagne
            </address>
          </div>

          <div>
            <p class="ha-footer-title">Espace exposant</p>
            <a routerLink="/" class="ha-footer-link">Accueil</a>
            <a routerLink="/contact" class="ha-footer-link">Contact</a>
            <a routerLink="/login" class="ha-footer-link">Connexion</a>
            <a routerLink="/register" class="ha-footer-link">Créer un compte</a>
          </div>

          <div>
            <p class="ha-footer-title">Nous écrire</p>
            <a [href]="'mailto:' + contactEmail" class="ha-footer-link">{{ contactEmail }}</a>
            <a
              href="https://www.historic-auto.com"
              target="_blank"
              rel="noopener"
              class="ha-footer-link"
            >
              Site officiel du salon
            </a>
          </div>
        </div>

        <p class="ha-footer-bottom">© {{ currentYear }} Historic Auto — Espace exposant</p>
      </div>
    </footer>
  `,
})
export class PublicFooterComponent {
  protected readonly contactEmail = environment.contactEmail;
  protected readonly currentYear = new Date().getFullYear();
}
```

- [ ] **Step 5 : Créer l'en-tête**

Créer `src/app/public/layout/public-header.component.ts` :

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';

@Component({
  selector: 'app-public-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-header.component.html',
})
export class PublicHeaderComponent {
  protected readonly auth = inject(AuthService);

  /** Menu déroulant affiché sous `md` uniquement. */
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
```

Créer `src/app/public/layout/public-header.component.html`. La zone de CTA est enveloppée dans `@if (auth.isInitialized())` : `AuthService` appelle `/me` au démarrage, et sans cette garde un exposant déjà connecté verrait « Connexion » clignoter avant « Mon Espace ».

```html
<header class="ha-header">
  <div class="ha-container">
    <div class="ha-header-inner">
      <a routerLink="/" class="ha-brand" (click)="closeMenu()">
        <span class="auth-logo-mark">HA</span>
        <span class="auth-logo-text">Historic Auto</span>
      </a>

      <nav class="ha-nav">
        <a
          routerLink="/"
          class="ha-nav-link"
          routerLinkActive="ha-nav-link--active"
          [routerLinkActiveOptions]="{ exact: true }"
        >
          Accueil
        </a>
        <a routerLink="/contact" class="ha-nav-link" routerLinkActive="ha-nav-link--active">
          Contact
        </a>
      </nav>

      <div class="ha-header-actions">
        @if (auth.isInitialized()) {
          @if (auth.isAuthenticated()) {
            <a routerLink="/dashboard" class="ha-btn ha-btn--primary">Mon Espace</a>
          } @else {
            <a routerLink="/login" class="ha-nav-link">Connexion</a>
            <a routerLink="/register" class="ha-btn ha-btn--primary">Créer un compte</a>
          }
        }
      </div>

      <button
        type="button"
        class="ha-burger"
        (click)="toggleMenu()"
        [attr.aria-expanded]="menuOpen()"
        aria-controls="ha-mobile-menu"
        aria-label="Ouvrir le menu"
      >
        <i class="pi" [class.pi-bars]="!menuOpen()" [class.pi-times]="menuOpen()" aria-hidden="true"></i>
      </button>
    </div>

    @if (menuOpen()) {
      <nav id="ha-mobile-menu" class="ha-mobile-menu">
        <a routerLink="/" class="ha-nav-link" (click)="closeMenu()">Accueil</a>
        <a routerLink="/contact" class="ha-nav-link" (click)="closeMenu()">Contact</a>

        @if (auth.isInitialized()) {
          @if (auth.isAuthenticated()) {
            <a routerLink="/dashboard" class="ha-btn ha-btn--primary" (click)="closeMenu()">
              Mon Espace
            </a>
          } @else {
            <a routerLink="/login" class="ha-nav-link" (click)="closeMenu()">Connexion</a>
            <a routerLink="/register" class="ha-btn ha-btn--primary" (click)="closeMenu()">
              Créer un compte
            </a>
          }
        }
      </nav>
    }
  </div>
</header>
```

- [ ] **Step 6 : Créer le layout**

Créer `src/app/public/layout/public-layout.component.ts` :

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PublicHeaderComponent } from './public-header.component';
import { PublicFooterComponent } from './public-footer.component';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, PublicHeaderComponent, PublicFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ha-shell">
      <app-public-header />
      <main class="ha-main">
        <router-outlet />
      </main>
      <app-public-footer />
    </div>
  `,
})
export class PublicLayoutComponent {}
```

- [ ] **Step 7 : Créer les deux pages en version provisoire**

Ces deux composants sont volontairement minimaux : la Task 1 valide le routage, pas le contenu. Les Tasks 2 à 5 les remplissent.

Créer `src/app/public/pages/home/home.component.ts` :

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
})
export class HomeComponent {}
```

Créer `src/app/public/pages/home/home.component.html` :

```html
<section class="ha-container ha-section">
  <h1 class="ha-h1">Accueil</h1>
</section>
```

Créer `src/app/public/pages/contact/contact.component.ts` :

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-contact',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact.component.html',
})
export class ContactComponent {}
```

Créer `src/app/public/pages/contact/contact.component.html` :

```html
<section class="ha-container ha-section">
  <h1 class="ha-h1">Nous contacter</h1>
</section>
```

- [ ] **Step 8 : Déclarer les routes publiques**

Créer `src/app/public/public.routes.ts` :

```ts
import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layout/public-layout.component';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
        title: 'Historic Auto — Espace exposant',
      },
      {
        path: 'contact',
        loadComponent: () =>
          import('./pages/contact/contact.component').then((m) => m.ContactComponent),
        title: 'Nous contacter',
      },
    ],
  },
];
```

- [ ] **Step 9 : Brancher les routes publiques**

Remplacer intégralement `src/app/app.routes.ts` par :

```ts
import { Routes } from '@angular/router';
import { PUBLIC_ROUTES } from '@app/public/public.routes';
import { AUTH_ROUTES } from '@app/core/core.route';
import { DASHBOARD_ROUTES } from '@app/dashboard/dashboard.routes';

export const routes: Routes = [
  ...PUBLIC_ROUTES,
  ...AUTH_ROUTES,
  ...DASHBOARD_ROUTES,
  { path: '**', redirectTo: '' },
];
```

`PUBLIC_ROUTES` et `AUTH_ROUTES` déclarent tous deux un parent de chemin `''`. Pour `/login`, le parent public correspond mais aucun de ses enfants ne correspond : Angular rebrousse alors chemin et essaie `AUTH_ROUTES`. C'est exactement ce que l'étape 11 vérifie.

- [ ] **Step 10 : Créer le dossier d'images et compiler**

```bash
mkdir -p public/images && touch public/images/.gitkeep
npx ng build
```

Attendu : `Application bundle generation complete`, aucune erreur TypeScript, aucune erreur de template.

- [ ] **Step 11 : Vérifier le routage en navigateur**

Démarrer la configuration `front-main` (port 4200), puis visiter chaque URL et noter le résultat :

| URL | Attendu |
|---|---|
| `/` | En-tête + « Accueil » + pied de page. Onglet : « Historic Auto — Espace exposant ». |
| `/contact` | En-tête + « Nous contacter » + pied de page. Lien Contact souligné comme actif, lien Accueil non actif. |
| `/login` | Formulaire de connexion **inchangé**, sans en-tête ni pied de page publics. |
| `/register` | Formulaire d'inscription inchangé. |
| `/forgot-password` | Formulaire de mot de passe oublié inchangé. |
| `/dashboard` | Redirige vers `/login` si déconnecté, affiche Mon Espace si connecté. |
| `/nimportequoi` | Redirige vers `/`. |

Vérifier aussi la console navigateur : aucune erreur.

**Si `/login` n'affiche plus le formulaire**, le repli d'Angular n'a pas eu lieu. Le contournement est alors de supprimer la route parente publique : `PublicLayoutComponent` est abandonné, `HomeComponent` et `ContactComponent` importent eux-mêmes `PublicHeaderComponent` et `PublicFooterComponent` et les rendent autour de leur contenu, et `PUBLIC_ROUTES` devient deux routes de premier niveau :

```ts
export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
    title: 'Historic Auto — Espace exposant',
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./pages/contact/contact.component').then((m) => m.ContactComponent),
    title: 'Nous contacter',
  },
];
```

Le coût est de deux balises dupliquées par page, et les Tasks 2 à 5 restent identiques par ailleurs. Signalez au réviseur que ce contournement a été nécessaire.

- [ ] **Step 12 : Vérifier le CTA de l'en-tête**

Se connecter, revenir sur `/`, puis recharger la page (F5). Attendu : la zone de droite de l'en-tête reste vide un instant puis affiche **Mon Espace**. Elle ne doit à aucun moment afficher « Connexion » / « Créer un compte ».

Réduire ensuite la fenêtre à 375px : la nav et les boutons disparaissent au profit du bouton burger ; l'ouvrir affiche les liens et le CTA ; cliquer un lien referme le menu.

- [ ] **Step 13 : Commit**

```bash
git add src/app/public src/app/core/styles/public.theme.css src/app/app.routes.ts src/styles.scss src/index.html public/images/.gitkeep
git commit -m "feat(public): coquille publique, thème et routage des pages / et /contact"
```

---

### Task 2 : Hero de la page d'accueil

**Files:**
- Modify: `src/app/public/pages/home/home.component.ts`
- Modify: `src/app/public/pages/home/home.component.html`

**Interfaces:**
- Consumes : `AuthService` (`isInitialized()`, `isAuthenticated()`), classes `.ha-hero`, `.ha-eyebrow`, `.ha-h1`, `.ha-lead`, `.ha-hero-actions`, `.ha-btn`, `.ha-btn--primary`, `.ha-image-slot`, `.ha-image-slot--hero`, `.ha-image-slot-label`, `.ha-image-slot-hint`, `.auth-link`.
- Produces : `HomeComponent.auth` (protégé, consommé par le template de la Task 3).

- [ ] **Step 1 : Injecter AuthService dans HomeComponent**

Remplacer intégralement `src/app/public/pages/home/home.component.ts` par :

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';

/**
 * Page de présentation publique. Purement présentationnelle : sa seule dépendance est
 * `AuthService`, utilisé pour adapter l'intitulé et la cible des appels à l'action.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
})
export class HomeComponent {
  protected readonly auth = inject(AuthService);
}
```

- [ ] **Step 2 : Écrire le hero**

Remplacer intégralement `src/app/public/pages/home/home.component.html` par :

```html
<!-- ── Hero ── -->
<section class="ha-container">
  <div class="ha-hero">
    <div>
      <p class="ha-eyebrow">Espace exposant</p>

      <h1 class="ha-h1">Réservez votre stand pour la 6<sup>e</sup> édition</h1>

      <p class="ha-lead">
        Historic Auto ouvre son espace en ligne aux exposants. Constituez votre dossier à votre
        rythme — entité, stand et options, devis, documents, paiement — et suivez son avancement
        à tout moment.
      </p>

      <div class="ha-hero-actions">
        @if (auth.isInitialized()) {
          @if (auth.isAuthenticated()) {
            <a routerLink="/dashboard" class="ha-btn ha-btn--primary">Accéder à mon espace</a>
          } @else {
            <a routerLink="/register" class="ha-btn ha-btn--primary">
              Créer mon compte exposant
            </a>
            <a routerLink="/login" class="auth-link">J'ai déjà un compte</a>
          }
        }
      </div>
    </div>

    <!--
      Emplacement image. Pour le remplacer, déposer le fichier dans public/images/ puis
      substituer le bloc .ha-image-slot ci-dessous par :

      <img
        src="/images/hero.jpg"
        alt="Véhicules de collection exposés au salon Historic Auto"
        class="w-full aspect-[4/3] object-cover border border-[#D4C9A8] border-l-4 border-l-[#B8860B]"
      />
    -->
    <div class="ha-image-slot ha-image-slot--hero">
      <span class="ha-image-slot-label">Photo à fournir</span>
      <span class="ha-image-slot-hint">public/images/hero.jpg — ratio 4:3</span>
    </div>
  </div>
</section>
```

Note : `angular.json` copie `public/**/*` à la racine servie, l'URL est donc `/images/hero.jpg` et non `/public/images/hero.jpg`.

- [ ] **Step 3 : Compiler**

```bash
npx ng build
```

Attendu : `Application bundle generation complete`, aucune erreur.

- [ ] **Step 4 : Vérifier en navigateur**

Sur `/`, déconnecté : surtitre or en petites capitales, titre serif sur deux lignes, chapô gris, bouton or « Créer mon compte exposant » qui mène à `/register`, lien « J'ai déjà un compte » qui mène à `/login`, emplacement image sable à droite au ratio 4:3.

Connecté : un seul bouton, « Accéder à mon espace », qui mène à `/dashboard`. Le lien « J'ai déjà un compte » a disparu.

À 375px : les deux colonnes s'empilent, le titre ne déborde pas, aucun défilement horizontal.

- [ ] **Step 5 : Commit**

```bash
git add src/app/public/pages/home
git commit -m "feat(public): hero de la page d'accueil"
```

---

### Task 3 : Bandeau salon, bande image, étapes et clôture

**Files:**
- Modify: `src/app/public/pages/home/home.component.ts`
- Modify: `src/app/public/pages/home/home.component.html`

**Interfaces:**
- Consumes : `HomeComponent.auth` (Task 2), classes `.ha-band`, `.ha-band-meta`, `.ha-band-meta-strong`, `.ha-stats`, `.ha-stat`, `.ha-stat-value`, `.ha-stat-label`, `.ha-image-slot--band`, `.ha-section`, `.ha-section-title`, `.ha-section-lead`, `.ha-steps`, `.ha-step`, `.ha-step-index`, `.ha-step-title`, `.ha-step-text`, `.ha-cta`, `.ha-cta-title`, `.ha-cta-text`, `.ha-cta-link`.
- Produces : `HomeComponent.stats: readonly HomeStat[]`, `HomeComponent.steps: readonly HomeStep[]`.

- [ ] **Step 1 : Ajouter les données de sections**

Remplacer intégralement `src/app/public/pages/home/home.component.ts` par :

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';

interface HomeStat {
  readonly value: string;
  readonly label: string;
}

interface HomeStep {
  readonly index: string;
  readonly title: string;
  readonly text: string;
}

/**
 * Page de présentation publique. Purement présentationnelle : sa seule dépendance est
 * `AuthService`, utilisé pour adapter l'intitulé et la cible des appels à l'action.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
})
export class HomeComponent {
  protected readonly auth = inject(AuthService);

  /** Chiffres publiés par historic-auto.com/histoire. Ne pas en ajouter d'autres sans source. */
  protected readonly stats: readonly HomeStat[] = [
    { value: '40 000', label: 'visiteurs' },
    { value: '330', label: 'exposants' },
    { value: '27 000 m²', label: 'de surface' },
    { value: '30', label: 'expositions thématiques' },
  ];

  /**
   * Reprend à l'identique, et dans le même ordre, le stepper réel de
   * `edition-form-page.component.html` : Entité, Stand, Confirmation, Documents, Paiement.
   * Si ce stepper change, cette liste doit changer avec lui.
   */
  protected readonly steps: readonly HomeStep[] = [
    {
      index: '01',
      title: 'Entité',
      text: "Renseignez votre raison sociale, votre domaine d'activité et les responsables présents sur le stand.",
    },
    {
      index: '02',
      title: 'Stand',
      text: 'Choisissez votre surface, puis ajoutez les options complémentaires dont vous avez besoin.',
    },
    {
      index: '03',
      title: 'Confirmation',
      text: 'Consultez votre devis, validez la checklist et confirmez votre participation.',
    },
    {
      index: '04',
      title: 'Documents',
      text: "Déposez vos pièces justificatives et votre attestation d'assurance RC, et retrouvez les documents communs à l'édition.",
    },
    {
      index: '05',
      title: 'Paiement',
      text: 'Consultez le récapitulatif financier, suivez vos paiements enregistrés et réglez en ligne.',
    },
  ];
}
```

- [ ] **Step 2 : Ajouter les quatre sections au template**

Ajouter le bloc suivant à la **fin** de `src/app/public/pages/home/home.component.html`, après la section hero écrite en Task 2. Ne modifiez pas le hero.

```html
<!-- ── Bandeau salon ── -->
<section class="ha-band">
  <div class="ha-container">
    <p class="ha-band-meta">
      <span class="ha-band-meta-strong">Février 2028</span>
      <span aria-hidden="true">·</span>
      <span class="ha-band-meta-strong">Nantes, Parc des Expositions</span>
      <span aria-hidden="true">·</span>
      <span>6<sup>e</sup> édition du salon du véhicule de collection</span>
    </p>

    <div class="ha-stats">
      @for (stat of stats; track stat.label) {
        <div class="ha-stat">
          <p class="ha-stat-value">{{ stat.value }}</p>
          <p class="ha-stat-label">{{ stat.label }}</p>
        </div>
      }
    </div>
  </div>
</section>

<!-- ── Bande image ── -->
<section class="ha-container ha-section">
  <!--
    Emplacement image. Pour le remplacer, déposer le fichier dans public/images/ puis
    substituer le bloc .ha-image-slot ci-dessous par :

    <img
      src="/images/salon.jpg"
      alt="Vue d'ensemble des allées du salon Historic Auto"
      class="w-full aspect-[3/1] object-cover border border-[#D4C9A8] border-l-4 border-l-[#B8860B]"
    />
  -->
  <div class="ha-image-slot ha-image-slot--band">
    <span class="ha-image-slot-label">Photo à fournir</span>
    <span class="ha-image-slot-hint">public/images/salon.jpg — ratio 3:1</span>
  </div>
</section>

<!-- ── Comment ça marche ── -->
<section class="ha-container ha-section">
  <h2 class="ha-section-title">Comment ça marche</h2>
  <p class="ha-section-lead">
    Votre demande de stand se construit en cinq étapes. Vous pouvez l'interrompre et la reprendre
    quand vous le souhaitez : votre saisie est enregistrée au fur et à mesure.
  </p>

  <div class="ha-steps">
    @for (step of steps; track step.index) {
      <article class="ha-step">
        <span class="ha-step-index">{{ step.index }}</span>
        <h3 class="ha-step-title">{{ step.title }}</h3>
        <p class="ha-step-text">{{ step.text }}</p>
      </article>
    }
  </div>
</section>

<!-- ── Appel à l'action de clôture ── -->
<section class="ha-container ha-section">
  <div class="ha-cta">
    <h2 class="ha-cta-title">Prêt à déposer votre demande ?</h2>

    <p class="ha-cta-text">
      La création de compte prend moins d'une minute. Vous pourrez ensuite commencer votre dossier
      et le compléter quand vous le souhaitez.
    </p>

    @if (auth.isInitialized()) {
      @if (auth.isAuthenticated()) {
        <a routerLink="/dashboard" class="ha-btn ha-btn--primary">Accéder à mon espace</a>
      } @else {
        <a routerLink="/register" class="ha-btn ha-btn--primary">Créer mon compte exposant</a>
      }
    }

    <p class="ha-cta-text mt-8 mb-0">
      Une question ? <a routerLink="/contact" class="ha-cta-link">Écrivez-nous</a>.
    </p>
  </div>
</section>
```

- [ ] **Step 3 : Compiler**

```bash
npx ng build
```

Attendu : `Application bundle generation complete`, aucune erreur.

- [ ] **Step 4 : Vérifier en navigateur**

Sur `/` : bandeau sable clair avec « Février 2028 · Nantes, Parc des Expositions · 6e édition du salon du véhicule de collection », puis quatre cartes blanches à filet or affichant 40 000 visiteurs, 330 exposants, 27 000 m² de surface, 30 expositions thématiques. Puis l'emplacement image en 3:1. Puis cinq cartes d'étapes dans l'ordre Entité, Stand, Confirmation, Documents, Paiement. Puis le bloc encre avec le bouton or et le lien « Écrivez-nous » vers `/contact`.

Connecté : le bouton de clôture affiche « Accéder à mon espace ».

À 375px : les chiffres passent sur deux colonnes, les étapes sur une colonne, aucun défilement horizontal.

- [ ] **Step 5 : Commit**

```bash
git add src/app/public/pages/home
git commit -m "feat(public): bandeau salon, étapes et clôture de la page d'accueil"
```

---

### Task 4 : Modèle et service de contact

**Files:**
- Create: `src/app/public/models/contact.model.ts`
- Create: `src/app/public/services/contact.service.ts`

**Interfaces:**
- Consumes : rien.
- Produces :
  - `type ContactSubject = 'stand' | 'demande' | 'facturation' | 'autre'`
  - `interface ContactRequest { name: string; email: string; subject: ContactSubject; message: string }`
  - `class ContactService { send(payload: ContactRequest): Observable<void> }`, `providedIn: 'root'`.

- [ ] **Step 1 : Créer le modèle**

Créer `src/app/public/models/contact.model.ts` :

```ts
/** Motif du message, choisi dans la liste déroulante du formulaire de contact. */
export type ContactSubject = 'stand' | 'demande' | 'facturation' | 'autre';

/** Charge utile envoyée par le formulaire de contact. */
export interface ContactRequest {
  name: string;
  email: string;
  subject: ContactSubject;
  message: string;
}
```

- [ ] **Step 2 : Créer le service**

Créer `src/app/public/services/contact.service.ts` :

```ts
import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { ContactRequest } from '@app/public/models/contact.model';

/**
 * Envoi du formulaire de contact.
 *
 * L'endpoint back n'existe pas encore : `send()` simule aujourd'hui une réponse réussie après
 * un court délai, ce qui permet au composant de gérer dès maintenant ses trois états.
 *
 * Cette méthode est la seule frontière à modifier le jour où le back est disponible :
 * injecter `HttpClient`, importer `environment`, et remplacer le corps par l'appel commenté.
 * Le composant n'a pas à changer.
 */
@Injectable({ providedIn: 'root' })
export class ContactService {
  send(payload: ContactRequest): Observable<void> {
    // TODO(back) : remplacer par
    // return this.http.post<void>(`${environment.apiUrl}/contact`, payload);
    return of(void 0).pipe(delay(600));
  }
}
```

- [ ] **Step 3 : Compiler**

```bash
npx ng build
```

Attendu : `Application bundle generation complete`. Le paramètre `payload` est inutilisé, ce qui est volontaire et sans conséquence : ni `noUnusedParameters` ni ESLint ne sont configurés sur ce projet.

- [ ] **Step 4 : Commit**

```bash
git add src/app/public/models src/app/public/services
git commit -m "feat(public): modèle et service stub du formulaire de contact"
```

---

### Task 5 : Formulaire de contact

**Files:**
- Modify: `src/app/public/pages/contact/contact.component.ts`
- Modify: `src/app/public/pages/contact/contact.component.html`

**Interfaces:**
- Consumes : `ContactService.send(payload: ContactRequest): Observable<void>` et `ContactRequest` / `ContactSubject` (Task 4) ; `AuthService.isInitialized()`, `AuthService.currentUser()` retournant `AuthUser | null` avec `firstName: string` et `email: string` ; `environment.contactEmail` ; classes `.ha-contact-grid`, `.ha-panel`, `.ha-identity`, `.ha-identity-name`, `.ha-textarea`, `.ha-success`, `.ha-success-icon`, `.ha-aside`, `.ha-aside-title`, `.ha-aside-text`, plus `.auth-field`, `.auth-label`, `.auth-input`, `.auth-input--error`, `.auth-field-error`, `.auth-error-banner`, `.auth-btn-primary`, `.auth-link`.
- Produces : rien pour les tâches suivantes.

- [ ] **Step 1 : Écrire le composant**

Remplacer intégralement `src/app/public/pages/contact/contact.component.ts` par :

```ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { AuthService } from '@app/core/services/auth.service';
import { ContactRequest, ContactSubject } from '@app/public/models/contact.model';
import { ContactService } from '@app/public/services/contact.service';
import { environment } from '../../../../environments/environment';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SubjectOption {
  readonly label: string;
  readonly value: ContactSubject;
}

/**
 * Formulaire de contact public.
 *
 * Un exposant connecté n'a pas à ressaisir son identité : les champs nom et adresse email
 * sont remplacés par un rappel, et les valeurs de son profil alimentent la charge utile.
 */
@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact.component.html',
})
export class ContactComponent {
  private readonly contactService = inject(ContactService);
  protected readonly auth = inject(AuthService);

  protected readonly contactEmail = environment.contactEmail;

  protected readonly subjectOptions: readonly SubjectOption[] = [
    { label: 'Réserver un stand', value: 'stand' },
    { label: 'Question sur ma demande', value: 'demande' },
    { label: 'Facturation', value: 'facturation' },
    { label: 'Autre', value: 'autre' },
  ];

  // ── Saisie ──
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly subject = signal<ContactSubject | null>(null);
  protected readonly message = signal('');

  protected readonly nameTouched = signal(false);
  protected readonly emailTouched = signal(false);
  protected readonly subjectTouched = signal(false);
  protected readonly messageTouched = signal(false);

  // ── États ──
  protected readonly loading = signal(false);
  protected readonly sent = signal(false);
  protected readonly apiError = signal<string | null>(null);

  /**
   * Profil de l'exposant connecté, ou `null` tant que l'authentification n'est pas résolue
   * ou si le visiteur n'est pas connecté. Attendre `isInitialized()` évite d'afficher les
   * champs nom et email une fraction de seconde avant de les remplacer par le rappel.
   */
  protected readonly knownUser = computed(() =>
    this.auth.isInitialized() ? this.auth.currentUser() : null
  );

  /** Adresse à laquelle la réponse sera envoyée, rappelée dans l'état de succès. */
  protected readonly replyToEmail = computed(
    () => this.knownUser()?.email ?? this.email().trim()
  );

  protected readonly nameError = computed<string | null>(() => {
    if (this.knownUser() !== null || !this.nameTouched()) {
      return null;
    }
    const value = this.name().trim();
    if (value.length === 0) {
      return 'Merci d’indiquer votre nom.';
    }
    if (value.length < 2) {
      return 'Le nom doit contenir au moins 2 caractères.';
    }
    return null;
  });

  protected readonly emailError = computed<string | null>(() => {
    if (this.knownUser() !== null || !this.emailTouched()) {
      return null;
    }
    const value = this.email().trim();
    if (value.length === 0) {
      return 'Merci d’indiquer votre adresse email.';
    }
    if (!EMAIL_PATTERN.test(value)) {
      return 'Cette adresse email n’est pas valide.';
    }
    return null;
  });

  protected readonly subjectError = computed<string | null>(() =>
    this.subjectTouched() && this.subject() === null ? 'Merci de choisir un sujet.' : null
  );

  protected readonly messageError = computed<string | null>(() => {
    if (!this.messageTouched()) {
      return null;
    }
    const value = this.message().trim();
    if (value.length === 0) {
      return 'Merci d’écrire votre message.';
    }
    if (value.length < 10) {
      return 'Le message doit contenir au moins 10 caractères.';
    }
    return null;
  });

  /** Validité réelle, indépendante du fait que les champs aient été touchés ou non. */
  private readonly formValid = computed(() => {
    const identityValid =
      this.knownUser() !== null ||
      (this.name().trim().length >= 2 && EMAIL_PATTERN.test(this.email().trim()));
    return identityValid && this.subject() !== null && this.message().trim().length >= 10;
  });

  protected onSubmit(): void {
    this.nameTouched.set(true);
    this.emailTouched.set(true);
    this.subjectTouched.set(true);
    this.messageTouched.set(true);
    this.apiError.set(null);

    const subject = this.subject();
    if (this.loading() || !this.formValid() || subject === null) {
      return;
    }

    const user = this.knownUser();
    const payload: ContactRequest = {
      name: user?.firstName ?? this.name().trim(),
      email: user?.email ?? this.email().trim(),
      subject,
      message: this.message().trim(),
    };

    this.loading.set(true);
    this.contactService.send(payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.sent.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.apiError.set(
          'Votre message n’a pas pu être envoyé. Merci de réessayer dans un instant.'
        );
      },
    });
  }

  protected reset(): void {
    this.name.set('');
    this.email.set('');
    this.subject.set(null);
    this.message.set('');
    this.nameTouched.set(false);
    this.emailTouched.set(false);
    this.subjectTouched.set(false);
    this.messageTouched.set(false);
    this.apiError.set(null);
    this.sent.set(false);
  }
}
```

- [ ] **Step 2 : Écrire le template**

Remplacer intégralement `src/app/public/pages/contact/contact.component.html` par :

```html
<section class="ha-container ha-section">
  <p class="ha-eyebrow">Contact</p>
  <h1 class="ha-h1">Nous contacter</h1>
  <p class="ha-lead">
    Une question sur votre demande de stand, sur les options ou sur votre facturation ?
    Écrivez-nous, nous vous répondons par email.
  </p>

  <div class="ha-contact-grid">
    <div class="ha-panel">
      @if (sent()) {
        <div class="ha-success">
          <div class="ha-success-icon">
            <i class="pi pi-check" aria-hidden="true"></i>
          </div>
          <h2 class="ha-section-title">Message envoyé</h2>
          <p class="ha-lead text-center">
            Merci, votre message est parti. Nous vous répondrons à l’adresse
            <strong>{{ replyToEmail() }}</strong>.
          </p>
          <button type="button" class="ha-btn ha-btn--ghost" (click)="reset()">
            Écrire un autre message
          </button>
        </div>
      } @else {
        @if (apiError()) {
          <div class="auth-error-banner">{{ apiError() }}</div>
        }

        @if (knownUser(); as user) {
          <p class="ha-identity">
            <i class="pi pi-user" aria-hidden="true"></i>
            <span>
              Vous écrivez en tant que
              <span class="ha-identity-name">{{ user.firstName }}</span> — {{ user.email }}
            </span>
          </p>
        } @else {
          <div class="auth-field">
            <label class="auth-label" for="contact-name">Nom</label>
            <input
              pInputText
              id="contact-name"
              type="text"
              placeholder="Votre nom"
              autocomplete="name"
              [ngModel]="name()"
              (ngModelChange)="name.set($event)"
              (blur)="nameTouched.set(true)"
              [disabled]="loading()"
              fluid
              class="auth-input"
              [class.auth-input--error]="nameError()"
            />
            @if (nameError()) {
              <p class="auth-field-error">{{ nameError() }}</p>
            }
          </div>

          <div class="auth-field">
            <label class="auth-label" for="contact-email">Adresse email</label>
            <input
              pInputText
              id="contact-email"
              type="email"
              placeholder="vous@exemple.com"
              autocomplete="email"
              [ngModel]="email()"
              (ngModelChange)="email.set($event)"
              (blur)="emailTouched.set(true)"
              [disabled]="loading()"
              fluid
              class="auth-input"
              [class.auth-input--error]="emailError()"
            />
            @if (emailError()) {
              <p class="auth-field-error">{{ emailError() }}</p>
            }
          </div>
        }

        <div class="auth-field">
          <label class="auth-label" for="contact-subject">Sujet</label>
          <p-select
            inputId="contact-subject"
            [options]="subjectOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Choisissez un sujet"
            [ngModel]="subject()"
            (ngModelChange)="subject.set($event)"
            (onBlur)="subjectTouched.set(true)"
            [disabled]="loading()"
            fluid
            [styleClass]="subjectError() ? 'auth-input--error' : ''"
          />
          @if (subjectError()) {
            <p class="auth-field-error">{{ subjectError() }}</p>
          }
        </div>

        <div class="auth-field">
          <label class="auth-label" for="contact-message">Message</label>
          <textarea
            id="contact-message"
            class="ha-textarea"
            placeholder="Décrivez votre demande en quelques lignes."
            [class.auth-input--error]="messageError()"
            [ngModel]="message()"
            (ngModelChange)="message.set($event)"
            (blur)="messageTouched.set(true)"
            [disabled]="loading()"
          ></textarea>
          @if (messageError()) {
            <p class="auth-field-error">{{ messageError() }}</p>
          }
        </div>

        <p-button
          label="Envoyer"
          styleClass="auth-btn-primary"
          [loading]="loading()"
          [disabled]="loading()"
          (onClick)="onSubmit()"
        />
      }
    </div>

    <aside class="ha-aside">
      <div>
        <p class="ha-aside-title">Nous écrire</p>
        <a [href]="'mailto:' + contactEmail" class="auth-link">{{ contactEmail }}</a>
      </div>

      <div>
        <p class="ha-aside-title">Adresse</p>
        <address class="ha-aside-text">
          HISTORIC AUTO<br />
          5 bis avenue de l’Europe<br />
          44260 La Montagne
        </address>
      </div>

      <div>
        <p class="ha-aside-title">Le salon</p>
        <a href="https://www.historic-auto.com" target="_blank" rel="noopener" class="auth-link">
          historic-auto.com
        </a>
      </div>
    </aside>
  </div>
</section>
```

- [ ] **Step 3 : Compiler**

```bash
npx ng build
```

Attendu : `Application bundle generation complete`, aucune erreur de template.

- [ ] **Step 4 : Vérifier le formulaire, déconnecté**

Sur `/contact`, sans être connecté :

1. Cliquer « Envoyer » sans rien saisir. Attendu : quatre messages d'erreur en rouge, un sous chaque champ, et aucun appel réseau.
2. Saisir `A` dans Nom, sortir du champ. Attendu : « Le nom doit contenir au moins 2 caractères. »
3. Saisir `pas-un-email` dans Adresse email, sortir du champ. Attendu : « Cette adresse email n’est pas valide. »
4. Saisir `court` dans Message, sortir du champ. Attendu : « Le message doit contenir au moins 10 caractères. »
5. Remplir correctement les quatre champs, choisir « Réserver un stand », cliquer « Envoyer ». Attendu : le bouton passe en chargement environ 0,6 s, puis le formulaire est remplacé par l'état de succès affichant l'adresse email saisie.
6. Cliquer « Écrire un autre message ». Attendu : le formulaire réapparaît vide, sans aucun message d'erreur affiché.

- [ ] **Step 5 : Vérifier le formulaire, connecté**

Se connecter, puis revenir sur `/contact`. Attendu : les champs Nom et Adresse email ont disparu, remplacés par « Vous écrivez en tant que {prénom} — {email} ». Seuls Sujet et Message restent à remplir. Après envoi, l'état de succès rappelle l'adresse email du profil.

- [ ] **Step 6 : Vérifier la colonne de coordonnées et le responsive**

La colonne de droite affiche `info@historic-auto.com` en lien `mailto:`, l'adresse postale sur trois lignes et le lien `historic-auto.com` qui s'ouvre dans un nouvel onglet.

À 375px : la colonne passe sous le formulaire, aucun défilement horizontal, la liste déroulante Sujet s'ouvre correctement.

- [ ] **Step 7 : Commit**

```bash
git add src/app/public/pages/contact
git commit -m "feat(public): formulaire de contact avec identité adaptative"
```

---

### Task 6 : Passe de vérification finale

**Files:** aucun fichier créé par défaut. Corrigez ce que la passe révèle.

**Interfaces:**
- Consumes : l'ensemble des livrables des Tasks 1 à 5.
- Produces : rien.

- [ ] **Step 1 : Compilation propre depuis zéro**

```bash
npx ng build
```

Attendu : `Application bundle generation complete`, zéro erreur, et **exactement les deux avertissements de budget préexistants** décrits dans les contraintes globales (bundle initial, `edition-form.theme.css`). Tout troisième avertissement est une régression à corriger.

- [ ] **Step 2 : Revue de non-régression des parcours existants**

Avec le serveur `front-main`, parcourir dans l'ordre : `/` → `/contact` → `/login` → se connecter → `/dashboard` → `/edition/{année}` → `/` → `/contact` → se déconnecter → `/`.

Attendu : aucune page cassée, aucune erreur dans la console navigateur, l'en-tête public n'apparaît que sur `/` et `/contact`, et le CTA de l'en-tête reflète correctement l'état de connexion à chaque passage.

- [ ] **Step 3 : Revue responsive**

Vérifier `/` et `/contact` à 375px puis 1280px. Attendu : aucun défilement horizontal, aucun texte tronqué, aucun chevauchement, le menu burger fonctionne à 375px et disparaît à 1280px.

- [ ] **Step 4 : Revue de code**

Utiliser la skill `superpowers:requesting-code-review` sur l'ensemble de la branche.

- [ ] **Step 5 : Commit final**

```bash
git add -A
git commit -m "chore(public): corrections issues de la passe de vérification"
```

Si la passe n'a rien révélé, aucune commit n'est nécessaire — dites-le explicitement plutôt que de créer un commit vide.
