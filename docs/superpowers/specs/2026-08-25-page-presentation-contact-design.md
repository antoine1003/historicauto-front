# Page de présentation et page de contact — Design

**Date :** 2026-08-25
**Périmètre :** front Angular uniquement (`historicauto-front`). La partie back du formulaire de contact est explicitement hors périmètre.

## Contexte

Le front exposant n'expose aujourd'hui aucune page publique : `/` ne rend rien (aucune route, aucun `**`), et le premier écran atteignable est `/login`. Le site officiel du salon (historic-auto.com) s'adresse au grand public ; ce front-ci est réservé aux exposants. Il lui manque une porte d'entrée qui rappelle de quel salon il s'agit et explique à quoi sert l'espace exposant, ainsi qu'une page de contact.

## Objectifs

1. Une page de présentation sur `/`, tournée portail (« réservez votre stand en ligne »), format court.
2. Une page `/contact` avec un formulaire fonctionnel côté front, prêt à recevoir son appel HTTP plus tard.
3. Un en-tête et un pied de page publics partagés par les deux pages.
4. Une atmosphère strictement identique à l'existant — mêmes jetons, mêmes classes, aucune nouvelle direction artistique.

## Hors périmètre

- Endpoint back du formulaire de contact, envoi d'e-mail, anti-spam.
- Photos réelles (emplacements balisés, fournis vides).
- Traduction, mode sombre, newsletter, contenu grand public (billetterie, horaires, tarifs visiteurs).
- Tests automatisés — conforme à la pratique du projet.

## Faits vérifiés sur le salon

Source : historic-auto.com et historic-auto.com/histoire, consultés le 2026-08-25.

- Historic Auto, salon du véhicule de collection, **6e édition, février 2028**, Parc des Expositions de **Nantes**.
- Rythme biennal : 2020, 2022, 2024, 2026, 2028.
- 3e salon national du véhicule de collection : **40 000+ visiteurs**, **27 000 m²**, **330 exposants**, **30 expositions thématiques**.
- Contact : `info@historic-auto.com` — HISTORIC AUTO, 5 bis avenue de l'Europe, 44260 La Montagne.

Aucun tarif de stand, date limite d'inscription, horaire ou numéro de téléphone n'a pu être vérifié : ces informations ne figurent sur aucune page du site officiel. Elles ne doivent donc apparaître nulle part dans les gabarits.

## Architecture

Nouveau dossier `src/app/public/`, aligné sur les feature folders existants (`core/`, `dashboard/`, `shared/`).

```
src/app/public/
  public.routes.ts
  layout/
    public-layout.component.ts
    public-header.component.ts
    public-footer.component.ts
  pages/
    home/home.component.ts        + home.component.html
    contact/contact.component.ts  + contact.component.html
  services/contact.service.ts
  models/contact.model.ts
src/app/core/styles/public.theme.css
public/images/.gitkeep
```

Chaque unité a une responsabilité unique : le layout assemble, le header décide du CTA d'après l'état d'authentification, le footer est statique, `home` est purement présentationnel, `contact` porte l'état du formulaire, `ContactService` isole l'accès réseau.

### Routage

```ts
// src/app/public/public.routes.ts
export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => ...HomeComponent,
        title: 'Historic Auto — Espace exposant' },
      { path: 'contact', loadComponent: () => ...ContactComponent,
        title: 'Nous contacter' },
    ],
  },
];
```

```ts
// src/app/app.routes.ts
export const routes: Routes = [
  ...PUBLIC_ROUTES,
  ...AUTH_ROUTES,
  ...DASHBOARD_ROUTES,
  { path: '**', redirectTo: '' },
];
```

**Point de vigilance :** `PUBLIC_ROUTES` et `AUTH_ROUTES` déclarent tous deux un parent de chemin `''`. Angular rebrousse chemin vers la route suivante lorsqu'aucun enfant ne correspond, donc `/login` doit continuer à résoudre via `AUTH_ROUTES`. C'est le seul risque structurel du chantier : il se vérifie en navigateur (`/`, `/login`, `/register`, `/forgot-password`, `/dashboard`, `/edition/:year`, plus une URL inconnue) avant d'écrire le contenu des pages.

`/` reste accessible aux exposants connectés : aucune redirection automatique vers `/dashboard`.

Le `**` est un ajout : aujourd'hui une URL inconnue n'affiche rien.

### Style

`src/app/core/styles/public.theme.css`, calqué sur `auth.theme.css` et `edition-form.theme.css` : `@reference "tailwindcss"` en tête, classes `@apply` préfixées `.ha-*`, importée dans `src/styles.scss` à l'intérieur de `@layer components`.

Jetons imposés, repris tels quels : crème `#F7F5F0`, or `#B8860B` (hover `#9A7009`), sable `#D4C9A8`, encre `#1A1714`, gris `#6B6560`, blanc cassé `#FAFAF7`. Serif Cormorant Garamond via `font-serif`, sans-serif DM Sans, `rounded-sm`, filet or de 4px à gauche des blocs saillants.

Classes existantes réutilisées sans duplication : `.auth-logo`, `.auth-logo-mark`, `.auth-logo-text`, `.auth-btn-primary`, `.auth-link`, `.auth-input`, `.auth-field`, `.auth-label`, `.auth-field-error`, `.auth-error-banner`, `.auth-divider`.

## Composants

### PublicLayoutComponent

`<app-public-header /> <main><router-outlet /></main> <app-public-footer />`. Aucune logique.

### PublicHeaderComponent

Marque à gauche (`.auth-logo-mark` « HA » + « Historic Auto », lien vers `/`), nav `Accueil · Contact`, zone CTA à droite pilotée par `AuthService` :

| État | Rendu |
|---|---|
| `!authService.isInitialized()` | zone vide |
| `isAuthenticated()` | bouton **Mon Espace** vers `/dashboard` |
| sinon | lien **Connexion** vers `/login` + bouton or **Créer un compte** vers `/register` |

L'attente de `isInitialized()` est nécessaire : `AuthService` appelle `/me` au démarrage, et sans elle un exposant connecté verrait « Connexion » clignoter.

Sous `md`, la nav bascule sur un menu déroulant piloté par un `signal<boolean>` local, refermé à la navigation.

### PublicFooterComponent

Trois colonnes : identité et adresse postale ; liens internes (Accueil, Contact, Connexion, Créer un compte) ; `environment.contactEmail` en `mailto:` et lien sortant vers `https://www.historic-auto.com` (`target="_blank" rel="noopener"`). Ligne de bas de page « © Historic Auto ».

### HomeComponent

Purement présentationnel, `ChangeDetectionStrategy.OnPush`. Sa seule dépendance est `AuthService`, pour l'intitulé du CTA du hero.

| # | Section | Contenu |
|---|---|---|
| 1 | Hero | Surtitre « Espace exposant ». H1 serif « Réservez votre stand pour la 6e édition ». Chapô sur la constitution du dossier en ligne. CTA **Créer mon compte exposant** — remplacé par **Accéder à mon espace** vers `/dashboard` si connecté — et lien Connexion (masqué si connecté). Emplacement image à droite. |
| 2 | Bandeau salon | Février 2028 · Nantes, Parc des Expositions · 6e édition, puis quatre chiffres séparés de filets or : 40 000 visiteurs, 330 exposants, 27 000 m², 30 expositions thématiques. |
| 3 | Bande image | Emplacement pleine largeur. |
| 4 | Comment ça marche | Les cinq étapes réelles du formulaire d'édition, dans leur ordre réel, une phrase chacune : Entité, Stand, Confirmation, Documents, Paiement. |
| 5 | CTA de clôture | Rappel du bouton d'inscription et lien « Une question ? Écrivez-nous » vers `/contact`. |

Les intitulés d'étapes correspondent au stepper réel de `edition-form-page.component.html:76-92`, relu le 2026-08-25. Ordre effectif : **Entité → Stand → Confirmation → Documents → Paiement**. Contenu réel de chaque étape, d'après les titres de section des composants :

| Étape | Contenu réel |
|---|---|
| Entité | « Votre entité » et « Responsables de stand » |
| Stand | choix de surface et « Options complémentaires » |
| Confirmation | consultation du devis, checklist, confirmation de participation |
| Documents | « Vos documents », « Documents communs à l'édition », « Assurance RC » |
| Paiement | « Récapitulatif financier », « Paiements enregistrés », « Régler en ligne » |

### Emplacements image

Classe `.ha-image-slot` : aplat sable, filet or, libellé centré indiquant le fichier attendu et le ratio. Deux emplacements :

- `public/images/hero.jpg`, ratio 4:3, colonne droite du hero ;
- `public/images/salon.jpg`, ratio 3:1, bande pleine largeur.

`angular.json` copie `public/**/*` à la racine servie : l'URL à utiliser dans les `<img>` est donc `/images/hero.jpg`, pas `/public/images/hero.jpg`.

Chaque emplacement est suivi, en commentaire HTML, du `<img>` correspondant prêt à décommenter — remplacer un placeholder ne demande aucune modification de structure ni de CSS. `public/images/.gitkeep` crée le dossier.

## Page de contact

### Modèle

```ts
// src/app/public/models/contact.model.ts
export type ContactSubject = 'stand' | 'demande' | 'facturation' | 'autre';

export interface ContactRequest {
  name: string;
  email: string;
  subject: ContactSubject;
  message: string;
}
```

### Formulaire

Deux colonnes : formulaire (2/3), coordonnées (1/3) ; empilées sous `md`.

Bloc identité adaptatif :

- **visiteur** — champs *Nom* et *Adresse email*, tous deux requis ;
- **connecté** — les deux champs disparaissent au profit d'une ligne « Vous écrivez en tant que {{ firstName }} — {{ email }} », lue depuis `AuthService.currentUser()`. Ces deux valeurs alimentent quand même `name` et `email` du payload.

Puis *Sujet* (`p-select`, options : Réserver un stand, Question sur ma demande, Facturation, Autre) et *Message* (textarea, `.auth-input` adaptée en hauteur).

Validation locale sur `signal`, sur le modèle de `login.component.ts` (`*Touched` + `computed` d'erreur) :

| Champ | Règle |
|---|---|
| Nom | requis, ≥ 2 caractères — ignoré si connecté |
| Email | requis, format valide — ignoré si connecté |
| Sujet | requis |
| Message | requis, ≥ 10 caractères |

Messages d'erreur sous le champ en `.auth-field-error`.

### Soumission

```ts
@Injectable({ providedIn: 'root' })
export class ContactService {
  send(payload: ContactRequest): Observable<void> {
    // TODO back : remplacer par
    // this.http.post<void>(`${environment.apiUrl}/contact`, payload)
    return of(void 0).pipe(delay(600));
  }
}
```

Le composant gère trois états :

- **envoi** — bouton `.auth-btn-primary` en `loading`, champs désactivés ;
- **succès** — le formulaire est remplacé par un état de confirmation (icône `pi-check-circle` or, « Message envoyé », rappel de l'adresse de réponse, bouton « Écrire un autre message » qui réinitialise le formulaire) ;
- **erreur** — `.auth-error-banner` au-dessus du formulaire, saisie conservée.

`ContactService` est la seule frontière à modifier le jour du back : une ligne.

### Coordonnées

`environment.contactEmail` en `mailto:` ; HISTORIC AUTO, 5 bis avenue de l'Europe, 44260 La Montagne ; lien sortant vers le site officiel.

## Vérification

Pas de tests automatisés. La vérification navigateur passe par la configuration `front-main` de `HistoricAuto/.claude/launch.json` (port 4200), qui sert bien la racine `historicauto-front`. Ne pas utiliser `frontend-dev` (port 4201) : elle pointe vers le worktree obsolète `registration-form-frontend-integration`. Si le chantier est mené dans un worktree dédié, ajouter une configuration pointant vers ce worktree plutôt que réutiliser une existante.

1. `ng build` sans erreur.
2. Navigation : `/` déconnecté, `/` connecté, `/contact` déconnecté, `/contact` connecté, `/login`, `/register`, `/forgot-password`, `/dashboard`, `/edition/:year`, une URL inconnue.
3. Header : absence de clignotement du CTA au rechargement en session connectée.
4. Formulaire de contact : erreurs de validation, envoi, état succès, réinitialisation.
5. Rendu à 375px et 1280px.
6. Console navigateur sans erreur.
