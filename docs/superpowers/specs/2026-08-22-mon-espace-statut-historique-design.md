# Mon Espace — statut de la demande active et historique des éditions

**Date :** 2026-08-22
**Périmètre :** front Angular uniquement (`historicauto-front`). Aucune modification back.

## Problème

La page `/dashboard` (« Mon Espace », le point d'entrée de l'espace exposant) affiche
aujourd'hui l'inverse de ce qu'elle devrait :

- Le bloc « Statut de votre demande » est imbriqué **dans la boucle des éditions passées**.
  La carte de l'édition active, elle, n'affiche aucun statut — seulement un bouton
  « Accéder au formulaire ».
- Les éditions passées sortent en `p-card` vide suivie d'un `p-button` placé hors carte.
- Deux liens pointent vers des routes inexistantes : `goToHistory()` vers
  `/mon-espace/historique/:id` et `contact()` vers `/mon-espace/contact`.
- Quand HA masque le formulaire (`isVisible` ou `registrationOpen` à `false`), la carte
  disparaît sans un mot.

En pratique l'exposant a **une seule demande active** et un historique d'éditions passées.
La page doit rendre ces deux choses lisibles d'un coup d'œil.

## Décision de cadrage : statut brut

Le statut affiché provient uniquement de `RegistrationStatus` (les 7 valeurs du back) et de
l'existence ou non d'une `Registration` pour l'édition active.

Conséquence assumée : les états « devis signé » et « acompte payé » ne sont **pas** affichés.
Ils vivent dans `Document.signatureStatus` et `Payment`, que `/registrations/mine` ne renvoie
pas ; les exposer demanderait d'enrichir `RegistrationSummaryDto`, ce qui est hors périmètre.

## Comportement attendu

### Table des statuts

| Situation | Libellé | Severity du `p-tag` |
|---|---|---|
| Aucune `Registration` sur l'édition active | Pas commencée | `secondary` |
| `draft` | Brouillon | `info` |
| `submitted` | Envoyée — en cours d'étude | `info` |
| `accepted` | Acceptée | `success` |
| `waitlisted` | Liste d'attente | `warn` |
| `refused` | Refusée | `danger` |
| `confirmed` | Confirmée | `success` |
| `completed` | Terminée | `success` |

Deux libellés changent par rapport à l'existant : `refused` passe de « Refusée / liste
d'attente » à « Refusée » (`waitlisted` est un statut distinct), et `confirmed` passe de
« Validée » à « Confirmée », aligné sur `RegistrationStatus::label()` côté back.

### Carte de la demande active

Grande carte en haut de page : titre **Édition {année}**, le `p-tag` de statut, une phrase
d'accompagnement, puis un bouton.

| Statut | Phrase | Libellé du bouton |
|---|---|---|
| Pas commencée | Les inscriptions sont ouvertes pour l'édition {année}. | Commencer mon inscription |
| Brouillon | Votre formulaire est enregistré mais pas encore envoyé. | Reprendre mon formulaire |
| Envoyée | Nous étudions votre demande. Vous serez notifié par email. | Consulter mon dossier |
| Acceptée | Votre demande est acceptée — il reste à confirmer votre participation et signer votre devis. | Accéder à mon dossier |
| Liste d'attente | (voir bannière ci-dessous) | Consulter mon dossier |
| Refusée | (voir bannière ci-dessous) | Consulter mon dossier |
| Confirmée | Votre inscription est confirmée. | Accéder à mon dossier |
| Terminée | Votre inscription est confirmée. | Accéder à mon dossier |

Pour `refused` et `waitlisted`, si `refusalComment` est non nul, il s'affiche dans une
bannière `auth-error-banner`. Pour `refused`, la bannière est suivie de la phrase
« Vous conservez votre espace et vos données. » (reprise du courrier type du cahier des
charges, STEP 4).

Le bouton navigue vers `/edition/{année}` dans tous les cas.

### Formulaire indisponible

Trois cas distincts, dictés par le comportement réel de l'API :

- **`edition.isVisible === false`** — `getByEditionYear` renvoie 404. La carte affiche le
  statut mais **aucun bouton**, avec la mention « Les inscriptions ne sont pas ouvertes pour
  le moment. »
- **`isVisible === true` et `registrationOpen === false`** — le dossier reste consultable en
  lecture seule. Le bouton « Consulter mon dossier » est conservé, avec la même mention.
- **Aucune édition active** — la carte est remplacée par la ligne « Aucune édition n'est
  ouverte actuellement. »

### Liste des éditions précédentes

Section « Mes éditions précédentes », **triée par année décroissante**. `findByExhibitor`
côté back trie en `ASC` ; le tri est fait côté front pour éviter une modification back.

Une ligne par édition : l'année en gras, le `p-tag` de statut, un lien « Consulter » vers
`/edition/{année}`. Le wizard gère déjà ce cas (`editionClosed`) : bannière « Édition passée
— affiché à titre d'historique », champs verrouillés, toutes les étapes cliquables.

Si l'exposant n'a aucune édition passée, la section entière n'est pas rendue — conforme au
cahier des charges (« S'il n'a pas participé au salon 2028, le lien Édition 2028
n'apparaît pas »).

## Architecture

`MonEspaceHomeComponent` conserve uniquement le chargement des données (le `forkJoin`
`getMine()` + `getActive()` déjà en place) et les deux `computed` `currentRegistration` /
`pastRegistrations`. Toute la présentation part dans deux composants sans état.

| Unité | Responsabilité | Interface |
|---|---|---|
| `dashboard/components/active-registration-card/` | Rend la carte du haut, y compris les états « pas commencée », « formulaire indisponible » et « aucune édition active » | Entrées : `registration: RegistrationSummary \| null`, `edition: Edition \| null` |
| `dashboard/components/past-registrations-list/` | Rend la liste compacte ; ne rend rien si le tableau est vide | Entrée : `registrations: RegistrationSummary[]` |
| `core/utils/registration-status.util.ts` | `statusLabel(status)` et `statusSeverity(status)`, fonctions pures | Aucune dépendance |

Le util est extrait parce que les deux composants ont besoin du même mapping ; le garder
comme méthode de la page obligerait à le dupliquer ou à le passer en entrée. Les deux
composants sont `standalone`, `ChangeDetectionStrategy.OnPush`, et se lisent indépendamment
l'un de l'autre.

`pastRegistrations` gagne un tri décroissant sur `edition.year`.

## Corrections annexes incluses

1. **`authGuard` sur `/edition/:year`** — la route du wizard n'a pas de garde, contrairement
   à `/dashboard`. Un visiteur non connecté charge la page et reçoit une 401 de l'API au lieu
   d'être redirigé vers le login. Ajout de `canActivate: [authGuard]` dans
   `dashboard.routes.ts` ; le `EditionFormStateService` reste dans les `providers` de la route.
2. **« Nous contacter »** — `contact()` et la route morte disparaissent. Le `p-button` devient
   un lien `mailto:`. L'adresse va dans `environment.contactEmail` (les deux fichiers
   d'environnement), suivant le pattern déjà utilisé pour `apiUrl`.
3. **`goToHistory()`** — supprimée avec sa route morte, remplacée par une navigation vers
   `/edition/{année}`.

## Hors périmètre

- Le wizard `/edition/:year` et `EditionFormStateService` (970 lignes) : le mode lecture seule
  des éditions passées fonctionne déjà.
- Toute modification back, y compris `RegistrationSummaryDto` et l'ordre de tri de
  `findByExhibitor`.
- Un écran récapitulatif d'historique dédié : le wizard en lecture seule fait l'office.

## Vérification

Pas de tests automatisés (préférence établie sur ce projet). La vérification se fait par :

1. `ng build` — zéro erreur de compilation ni de typage.
2. Contrôle visuel du front lancé, sur les états : pas commencée, brouillon, refusée avec
   commentaire, formulaire masqué, et la liste d'historique triée.
