import { Routes } from '@angular/router';
import { authGuard } from '@app/core/guards/auth.guard';
import { DashboardLayoutComponent } from '@app/dashboard/layout/dashboard-layout.component';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: DashboardLayoutComponent,
    // Remonté du niveau enfant : les deux routes le portaient à l'identique.
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./page/mon-espace-home/mon-espace-home.component')
            .then((m) => m.MonEspaceHomeComponent),
      },
      {
        path: 'edition/:year',
        loadComponent: () =>
          import('./page/edition-form/edition-form-page.component')
            .then((m) => m.EditionFormPageComponent),
        // Reste au niveau enfant : le service doit repartir d'un état propre à chaque entrée sur
        // une inscription, et ne jamais être partagé avec « Mon Espace ».
        providers: [EditionFormStateService],
      },
    ],
  },
];
