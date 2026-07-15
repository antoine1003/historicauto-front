# Connexion du formulaire d'inscription exposant (Étapes 1+2) au backend réel

- Date : 2026-07-15
- Repo concerné : `historicauto-front` (Angular 21)
- Dépend de : `historicauto-back`, branche `worktree-registration-form-backend-api` (pas encore mergée
  dans `develop` au moment de la rédaction — voir `historicauto-back/docs/superpowers/plans/2026-07-12-registration-form-backend-api.md`,
  12 tâches, revues individuelles + revue finale de branche complètes)
- Source métier : `HA6-Procedure-inscription-exposant Version DEV.pdf` (cahier des charges client)

## 1. Contexte et périmètre

Le front dispose d'un formulaire d'inscription à 5 étapes (Entité, Stand, Confirmation, Documents,
Paiement) entièrement mocké côté Étapes 1-2 : `mock-registrations.ts` simule la base,
`options-catalog.ts` code en dur des prix fictifs, et `EditionFormStateService.scheduleAutosave()`
simule le cycle `saving → saved` sans appel réseau. Le back expose désormais tous les endpoints
nécessaires (voir §3).

**Dans le périmètre de ce chantier :**
- Étape 1 (Entité) : chargement/persistance réels, y compris l'upload du logo/visuel et le CRUD des
  responsables de stand.
- Étape 2 (Stand) : catalogue d'options et tarifs réels (grilles Pro/Club), autosave réel, totaux
  calculés côté serveur.
- Soumission (transition `DRAFT → SUBMITTED`), avec remontée des erreurs de validation serveur.
- Ajout d'un système de notification global (Toast) pour les erreurs réseau.

**Hors périmètre (restent mockés/no-op côté front, comme aujourd'hui) :**
- Étape 3 (Confirmation) : checklist, signataire, signature Docuseal — `confirmRegistration()` reste
  un no-op local. Les valeurs par défaut affichées viennent désormais de la vraie réponse API
  (placeholders statiques renvoyés par le back), pas de `mock-registrations.ts`.
- Étape 4 (Documents) : devis, factures, assurance RC, liste fournisseurs — `uploadInsuranceDocument()`
  et `signQuote()` restent des no-op.
- Étape 5 (Paiement) : Stripe/CB, virement — lecture seule des placeholders statiques du back.
- `mon-espace-home.component.ts` : **déjà branché** sur `GET /api/registrations/mine` et
  `GET /api/editions/active`, non touché par ce chantier.

## 2. Modèle de données front — changements

### 2.1 `EditionRegistrationState`

Ajout du champ `id: string` (UUID de la `Registration`), absent aujourd'hui, requis par tous les
endpoints de mutation (`PATCH .../{id}/entity`, `.../stand`, etc.).

### 2.2 `OptionDefinition`

Suppression de `mockPriceTtc`/`mockVatRate`. Le type se rapproche du DTO backend
`OptionPriceDto` : `{ optionId, category, label, unit, includedBadges, exhibitorType, priceTtc, vatRate }`,
avec `exhibitorType: 'pro' | 'club' | null` (`null` = tarif commun Pro/Club, cf. toutes les catégories
hors Surface).

### 2.3 Suppressions

- `src/app/dashboard/services/options-catalog.ts` — supprimé, remplacé par `OptionsCatalogService`.
- `src/app/dashboard/services/mock-registrations.ts` — supprimé, remplacé par
  `RegistrationService.getByEditionYear()`.

## 3. Endpoints backend consommés (contrat gelé, branche `worktree-registration-form-backend-api`)

| Méthode | Route | Usage |
|---|---|---|
| GET | `/api/editions/{year}/option-prices` | Catalogue + tarifs (`OptionPriceDto[]`) |
| GET | `/api/activity-domains` | Liste des domaines d'activité Pro (`ActivityDomainDto[]`) |
| GET | `/api/registrations/by-edition-year/{year}` | Get-or-create du brouillon (`RegistrationDetailDto`) |
| PATCH | `/api/registrations/{id}/entity` | Autosave Étape 1 (`EntityStepDto` en retour) |
| PATCH | `/api/registrations/{id}/stand` | Autosave Étape 2 (`StandStepDto` en retour, total serveur) |
| POST | `/api/registrations/{id}/managers` | Ajout immédiat d'un responsable (`StandManagerDto`, 201) |
| DELETE | `/api/registrations/{id}/managers/{managerId}` | Suppression immédiate |
| POST | `/api/registrations/{id}/logo` | Upload logo (multipart, champ `file`) → `{ url }` |
| POST | `/api/registrations/{id}/submit` | Soumission (`{ status }` ou 422 avec `errors` par champ) |

Toutes les réponses suivent l'enveloppe `{ success, data }` ou `{ success: false, message, errors }`
(`ApiResponse` côté back). Les 403/404 du GET `by-edition-year` correspondent respectivement à
"inscriptions fermées" et "édition introuvable".

## 4. Services front (nouveaux/modifiés)

### 4.1 `OptionsCatalogService` (nouveau, `providedIn: 'root'`)

```typescript
getForEdition(year: string): Observable<OptionPriceDto[]>
```

Résultat mis en cache dans un signal par année (évite un re-fetch à chaque navigation d'étape dans le
même formulaire). Remplace `OPTIONS_CATALOG`, `getOptionById`, `getOptionsByCategory`.

### 4.2 `ActivityDomainService` (nouveau, `providedIn: 'root'`)

```typescript
getAll(): Observable<ActivityDomainDto[]>
```

Alimente le `<p-select>` du domaine d'activité dans `step-entity` (actuellement un champ texte libre
dans le mock — devient un vrai select lié à `activityDomainId`).

### 4.3 `RegistrationService` (extension du service existant)

Ajout de :
```typescript
getByEditionYear(year: string): Observable<ApiResponse<RegistrationDetailDto>>
patchEntity(id: string, body: Partial<EntityStepPayload>): Observable<ApiResponse<EntityStepDto>>
patchStand(id: string, body: StandStepPayload): Observable<ApiResponse<StandStepDto>>
addManager(id: string, body: NewManagerPayload): Observable<ApiResponse<StandManagerDto>>
removeManager(id: string, managerId: string): Observable<ApiResponse<null>>
uploadLogo(id: string, file: File): Observable<ApiResponse<{ url: string }>>
submit(id: string): Observable<ApiResponse<{ status: string }>>
```

## 5. `EditionFormStateService` — refonte des méthodes d'intégration

- **`loadForEditionYear(year)`** devient asynchrone : appelle `getByEditionYear`, peuple le state
  (incluant le nouveau champ `id`), gère un signal `loading` et distingue l'échec 403 ("inscriptions
  fermées") du 404 ("édition introuvable") pour le message affiché.
- **Deux pipelines d'autosave débouncées indépendantes** (800 ms, inchangé) :
  - `scheduleEntityAutosave()` : déclenchée par `updateEntity()`. Appelle `patchEntity`, réconcilie la
    réponse dans `state().entity`.
  - `scheduleStandAutosave()` : déclenchée par `selectSurfaceOption()`/`setOptionQuantity()`. Appelle
    `patchStand`, réconcilie `state().stand` **avec le total renvoyé par le serveur** (source de vérité
    pour `standTotalTtc`, remplace le calcul client actuel dans `standTotalTtc` computed — ce computed
    devient une simple lecture de `state().stand.standTotalTtc` au lieu d'un recalcul local).
  - Chaque pipeline a son propre statut `'saving' | 'saved' | 'error'` : `autosaveStatusSignal` unique
    est remplacé par deux signaux dédiés, `entityAutosaveStatus` et `standAutosaveStatus`, chacun
    exposé en lecture seule comme l'actuel `autosaveStatus`. Les composants d'étape n'affichent que le
    statut de leur propre étape.
  - Sur échec HTTP : statut `'error'` + `MessageService.add()` (Toast), le state local n'est pas perdu
    (l'utilisateur peut continuer à modifier, le prochain autosave retente).
- **`addManager`/`removeManager` deviennent des appels immédiats**, plus de debounce :
  - Ajout optimiste avec l'id local `crypto.randomUUID()`, remplacé par l'id serveur au succès de
    `POST .../managers`. Si l'appel échoue, retrait de l'entrée optimiste + Toast.
  - Suppression : appel `DELETE` direct: en cas d'échec, la ligne réapparaît + Toast (pas de suppression
    optimiste avant confirmation serveur, pour éviter de "perdre" un responsable si le réseau coupe).
- **`uploadInsuranceDocument()`** : inchangé (no-op, hors périmètre).
- **`onVisualSelected` → `uploadLogo`** : `StepEntityComponent.onVisualSelected` appelle
  `RegistrationService.uploadLogo(id, file)`, stocke l'URL retournée dans le state. Le champ
  `EntityStepState.visualFileName` est renommé `visualUrl: string | null` pour coller au DTO
  (`EntityStepDto.visualUrl`) — toutes les références dans `step-entity.component.html/ts` sont mises
  à jour en conséquence (affichage : nom de fichier extrait de l'URL ou aperçu image selon ce que le
  template fait déjà).
- **`submitRegistrationOptions()`** : appelle `RegistrationService.submit(id)`. Sur 422, les erreurs
  par champ (`errors: { siret: [...], stand: [...], ... }`) sont remontées au composant appelant
  (`StepStandComponent.submit()`) via une exception typée ou un signal d'erreurs, affichées en Toast +
  éventuellement sur le champ concerné si le composant a déjà un `FormControl` correspondant.
- **`confirmRegistration()`, `signQuote()`** : inchangés (no-op, hors périmètre).

## 6. UX erreurs et chargement

- `ToastModule` + `MessageService` ajoutés à `app.config.ts` (providers globaux), `<p-toast>` ajouté à
  `app.html`. Réutilisable au-delà de ce chantier.
- Échec de chargement de page (`notFound` / édition fermée) : reste un état bloquant affiché inline
  dans `edition-form-page.component.html` (pas un Toast, car il empêche l'usage de toute la page) — le
  booléen `notFound` existant est étendu avec un message différencié 403 vs 404.
- Toutes les autres erreurs (autosave, ajout/suppression manager, upload logo, soumission) : Toast.

## 7. Tests

- **Unitaires (`HttpClient` mocké via `HttpTestingController`)** :
  - `EditionFormStateService` : chargement initial (succès, 403, 404), debounce des deux pipelines
    d'autosave indépendantes (vérifier qu'un changement Entité ne déclenche pas d'appel `.../stand` et
    inversement), transition vers `'error'` sur échec HTTP, réconciliation du total serveur.
  - `OptionsCatalogService` / `ActivityDomainService` : cache par édition, un seul appel réseau pour
    plusieurs lectures successives.
  - `addManager`/`removeManager` : ajout optimiste + remplacement d'id, rollback sur échec.
- **Manuel** : parcours complet Pro et Club dans le navigateur contre le back réel (worktree local),
  vérification que les totaux affichés correspondent aux montants du cahier des charges, vérification
  Toast sur coupure réseau simulée (DevTools offline), vérification upload logo + persistance après
  rechargement de page.
