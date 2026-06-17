// src/app/features/mon-espace/mon-espace.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from '@app/core/guards/auth.guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./page/mon-espace-home/mon-espace-home.component')
        .then((m) => m.MonEspaceHomeComponent),
    canActivate: [authGuard],
  },
  {
    path: 'inscription',
    loadComponent: () =>
      import('./page/registration-wizard/registration-wizard.component')
        .then((m) => m.RegistrationWizardComponent),
    canActivate: [authGuard],
  },
  // {
  //   path: 'historique/:id',
  //   loadComponent: () =>
  //     import('./page/edition-history/edition-history.component')
  //       .then((m) => m.EditionHistoryComponent),
  // },
];
