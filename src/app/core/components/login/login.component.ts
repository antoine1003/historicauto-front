import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CheckboxModule,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private http   = inject(HttpClient);
  private router = inject(Router);

  // ── Form state ────────────────────────────────────
  email       = signal('');
  password    = signal('');
  rememberMe  = signal(false);

  // ── UI state ──────────────────────────────────────
  loading   = signal(false);
  apiError  = signal<string | null>(null);

  // ── Inline validation ─────────────────────────────
  emailTouched = signal(false);
  passTouched  = signal(false);

  emailError = computed(() => {
    if (!this.emailTouched()) return null;
    if (!this.email().trim()) return 'L\'email est requis';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email())) return 'Email invalide';
    return null;
  });

  passError = computed(() => {
    if (!this.passTouched()) return null;
    if (!this.password()) return 'Le mot de passe est requis';
    return null;
  });

  isFormValid = computed(() =>
    !this.emailError() &&
    !this.passError() &&
    !!this.email() &&
    !!this.password()
  );

  // ── Submit ────────────────────────────────────────
  onSubmit(): void {
    this.emailTouched.set(true);
    this.passTouched.set(true);

    if (!this.isFormValid()) return;

    this.loading.set(true);
    this.apiError.set(null);

    this.http
      .post<{ token: string }>('/api/login_check', {
        username: this.email().trim(),
        password: this.password(),
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          // Store JWT — adapt to your auth strategy
          const storage = this.rememberMe() ? localStorage : sessionStorage;
          storage.setItem('jwt_token', res.token);
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.loading.set(false);
          if (err.status === 401) {
            this.apiError.set('Email ou mot de passe incorrect.');
          } else {
            this.apiError.set('Une erreur est survenue. Veuillez réessayer.');
          }
        },
      });
  }
}
