// src/app/features/mon-espace/mon-espace.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from '@app/core/guards/auth.guard';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./page/mon-espace-home/mon-espace-home.component')
        .then((m) => m.MonEspaceHomeComponent),
    canActivate: [authGuard],
  },
  {
    path: 'edition/:year',
    loadComponent: () => import('./page/edition-form/edition-form-page.component').then((m) => m.EditionFormPageComponent),
    providers: [EditionFormStateService],
  },
];
