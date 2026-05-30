import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';

/**
 * Handles two flows:
 *  1. /forgot-password         → shows email input → POST /api/forgot-password
 *  2. /reset-password/:token   → shows new password form → POST /api/reset-password/:token
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    ButtonModule,
  ],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
})
export class ResetPasswordComponent implements OnInit {
  private http  = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // ── Flow detection ────────────────────────────────
  token   = signal<string | null>(null);
  isReset = computed(() => !!this.token()); // true = reset flow, false = forgot flow

  ngOnInit(): void {
    const t = this.route.snapshot.paramMap.get('token');
    this.token.set(t);
  }

  // ── Forgot password state ─────────────────────────
  email        = signal('');
  emailTouched = signal(false);

  emailError = computed(() => {
    if (!this.emailTouched()) return null;
    const v = this.email().trim();
    if (!v) return 'L\'email est requis';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Email invalide';
    return null;
  });

  // ── Reset password state ──────────────────────────
  newPassword      = signal('');
  confirmPassword  = signal('');
  passTouched      = signal(false);
  confirmTouched   = signal(false);

  passError = computed(() => {
    if (!this.passTouched()) return null;
    if (this.newPassword().length < 8) return 'Minimum 8 caractères';
    return null;
  });

  confirmError = computed(() => {
    if (!this.confirmTouched()) return null;
    if (this.confirmPassword() !== this.newPassword()) return 'Les mots de passe ne correspondent pas';
    return null;
  });

  // ── Shared UI state ───────────────────────────────
  loading  = signal(false);
  success  = signal(false);
  apiError = signal<string | null>(null);

  // ── Submit forgot password ────────────────────────
  onForgotSubmit(): void {
    this.emailTouched.set(true);
    if (this.emailError()) return;

    this.loading.set(true);
    this.apiError.set(null);

    this.http
      .post<{ message: string }>('/api/forgot-password', { email: this.email().trim() })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set(true);
        },
        error: () => {
          this.loading.set(false);
          // Per Symfony controller design, this should never show an error
          // but we handle it defensively
          this.success.set(true); // Always show success to prevent email enumeration
        },
      });
  }

  // ── Submit reset password ─────────────────────────
  onResetSubmit(): void {
    this.passTouched.set(true);
    this.confirmTouched.set(true);

    if (this.passError() || this.confirmError()) return;

    this.loading.set(true);
    this.apiError.set(null);

    this.http
      .post<{ message: string }>(`/api/reset-password/${this.token()}`, {
        password: this.newPassword(),
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set(true);
        },
        error: (err) => {
          this.loading.set(false);
          if (err.status === 400) {
            this.apiError.set('Ce lien est invalide ou a expiré. Veuillez faire une nouvelle demande.');
          } else {
            this.apiError.set('Une erreur est survenue. Veuillez réessayer.');
          }
        },
      });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
