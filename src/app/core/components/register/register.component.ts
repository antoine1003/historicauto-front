import { Component, ElementRef, inject, signal, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CaptchaFieldComponent } from '@app/shared/components/captcha/captcha-field.component';

// PrimeNG
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CaptchaFieldComponent,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private readonly captcha = viewChild(CaptchaFieldComponent);
  private readonly errorBanner = viewChild<ElementRef<HTMLElement>>('errorBanner');

  // ── Form state (Signals) ──────────────────────────
  email           = signal('');
  password        = signal('');
  passwordConfirm = signal('');

  // ── UI state ──────────────────────────────────────
  loading  = this.authService.isLoading;
  success  = signal(false);
  apiErrors = signal<string[]>([]);

  // ── Inline validation ─────────────────────────────
  emailTouched    = signal(false);
  passTouched     = signal(false);
  confirmTouched  = signal(false);

  emailError = computed(() => {
    if (!this.emailTouched()) return null;
    const v = this.email().trim();
    if (!v) return 'L\'email est requis';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Email invalide';
    return null;
  });

  passError = computed(() => {
    if (!this.passTouched()) return null;
    if (this.password().length < 8) return 'Minimum 8 caractères';
    return null;
  });

  confirmError = computed(() => {
    if (!this.confirmTouched()) return null;
    if (this.passwordConfirm() !== this.password()) return 'Les mots de passe ne correspondent pas';
    return null;
  });

  isFormValid = computed(() =>
    !this.emailError() &&
    !this.passError() &&
    !this.confirmError() &&
    !!this.email() &&
    !!this.password() &&
    !!this.passwordConfirm()
  );

  // ── Submit ────────────────────────────────────────
  onSubmit(): void {
    // Touch all fields to trigger validation
    this.emailTouched.set(true);
    this.passTouched.set(true);
    this.confirmTouched.set(true);
    this.captcha()?.markTouched();

    const captchaPayload = this.captcha()?.payload() ?? null;
    if (this.loading() || !this.isFormValid() || captchaPayload === null) return;

    this.apiErrors.set([]);

    this.authService.register({
      email: this.email().trim(),
      password: this.password(),
      firstName: '', // Added to match RegisterRequest interface
      ...captchaPayload,
    }).subscribe({
      next: () => {
        this.success.set(true);
      },
      error: (err) => {
        // Le défi est brûlé côté serveur même quand le rejet vient d'ailleurs — email déjà pris,
        // par exemple. Sans ce refresh, l'utilisateur resterait devant une question morte.
        this.captcha()?.refresh();
        const body = err.error;
        if (body?.errors) {
          this.apiErrors.set(body.errors);
        } else if (body?.message) {
          this.apiErrors.set([body.message]);
        } else {
          this.apiErrors.set(['Une erreur est survenue. Veuillez réessayer.']);
        }
        // La bannière n'existe dans le DOM qu'une fois l'erreur posée : on laisse un cycle de rendu
        // s'écouler avant de la chercher, puis on l'amène dans le champ de vision.
        setTimeout(() => {
          this.errorBanner()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 0);
      },
    });
  }
}
