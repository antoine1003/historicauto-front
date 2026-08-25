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
