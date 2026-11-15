import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

/**
 * `returnUrl` utilisable après connexion : uniquement un chemin interne (`/…`, pas `//hôte` ni
 * `/\hôte`), pour qu'un lien forgé `/login?returnUrl=…` ne puisse pas servir de redirection ouverte.
 */
export function safeReturnUrl(value: string | null): string | null {
  return value && /^\/(?![/\\])/.test(value) && !value.startsWith('/login') ? value : null;
}

/**
 * Non connecté → `/login?returnUrl=<url demandée>` : un lien d'email vers un onglet précis
 * (`/edition/2026?step=documents`) y ramène l'exposant une fois connecté.
 */
export const authGuard: CanActivateFn = (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return toObservable(authService.isInitialized).pipe(
    filter(initialized => initialized),
    take(1),
    map(() => {
      if (authService.isAuthenticated()) {
        return true;
      }
      const returnUrl = safeReturnUrl(state.url);
      return router.createUrlTree(['/login'], returnUrl ? { queryParams: { returnUrl } } : undefined);
    })
  );
};

export const guestGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return toObservable(authService.isInitialized).pipe(
    filter(initialized => initialized),
    take(1),
    map(() => {
      if (!authService.isAuthenticated()) {
        return true;
      }
      // Déjà connecté (ex. lien `/login?returnUrl=…` ouvert dans un onglet où la session est active).
      return router.parseUrl(safeReturnUrl(route.queryParamMap.get('returnUrl')) ?? '/dashboard');
    })
  );
};
