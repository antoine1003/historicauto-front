import { Routes } from '@angular/router';
import { RegisterComponent } from '@app/core/components/register/register.component';
import { LoginComponent } from '@app/core/components/login/login.component';
import { ResetPasswordComponent } from '@app/core/components/reset-password/reset-password.component';

export const AUTH_ROUTES: Routes = [
  {
    path: 'register',
    component: RegisterComponent,
    title: 'Créer un compte',
  },
  {
    path: 'login',
    component: LoginComponent,
    title: 'Connexion',
  },
  {
    path: 'forgot-password',
    component: ResetPasswordComponent,
    title: 'Mot de passe oublié',
  },
  {
    path: 'reset-password/:token',
    component: ResetPasswordComponent,
    title: 'Réinitialiser le mot de passe',
  },
];
