import { Routes } from '@angular/router';
import { AUTH_ROUTES } from '@app/core/core.route';
import { DASHBOARD_ROUTES } from '@app/dashboard/dashboard.routes';

export const routes: Routes = [
  ...AUTH_ROUTES,
  ...DASHBOARD_ROUTES
];
