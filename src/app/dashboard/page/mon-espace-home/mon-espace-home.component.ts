// src/app/features/mon-espace/pages/mon-espace-home/mon-espace-home.component.ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { RegistrationService } from '../../services/registration.service';
import { RegistrationSummary } from '@app/core/models/registration.model';

@Component({
  selector: 'app-mon-espace-home',
  standalone: true,
  imports: [ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-shell !min-h-0 !p-0 items-start justify-start">
      <div class="w-full max-w-3xl mx-auto px-4 py-8 sm:py-10">

        <header class="flex items-center justify-between mb-8">
          <h1 class="font-serif font-semibold text-2xl sm:text-[2.2rem] text-[#1A1714]">
            Mon Espace
          </h1>
          <p-button
            label="Nous contacter"
            severity="success"
            size="small"
            (onClick)="contact()"
          />
        </header>

        @if (loading()) {
          <p class="text-[#6B6560]">Chargement de vos éditions…</p>
        } @else {

          <!-- Historique : éditions passées où l'exposant a une Registration -->
          @for (reg of pastRegistrations(); track reg.id) {
            <button
              type="button"
              class="auth-link block mb-2 text-left"
              (click)="goToHistory(reg)"
            >
              Édition {{ reg.edition.year }}
            </button>
          }

          <!-- Édition active : lien d'inscription si ouverte ET visible -->
          @if (activeEdition() && showRegistrationLink()) {
            <div class="auth-card !max-w-none mt-6">
              <h2 class="auth-heading !text-[1.5rem]">
                Formulaire d'inscription exposant {{ activeEdition()!.year }}
              </h2>

              @if (currentRegistration()) {
                <p class="auth-subheading">
                  Statut de votre demande :
                  <strong>{{ statusLabel(currentRegistration()!.status) }}</strong>
                </p>

                @if (currentRegistration()!.status === 'refused' && currentRegistration()!.refusalComment) {
                  <div class="auth-error-banner">
                    {{ currentRegistration()!.refusalComment }}
                  </div>
                }
              }

              <p-button
                label="Accéder au formulaire"
                styleClass="auth-btn-primary !w-auto"
                (onClick)="goToWizard()"
              />
            </div>
          }

        }
      </div>
    </div>
  `,
})
export class MonEspaceHomeComponent {
  private readonly registrationService = inject(RegistrationService);
  private readonly router = inject(Router);

  private readonly registrations = signal<RegistrationSummary[]>([]);
  readonly loading = signal(true);

  readonly activeEdition = computed(() =>
    this.registrations().find((r) => r.edition.isActive)?.edition
    ?? this.registrations()[0]?.edition ?? null,
  );

  readonly currentRegistration = computed(() =>
    this.registrations().find((r) => r.edition.isActive) ?? null,
  );

  readonly pastRegistrations = computed(() =>
    this.registrations().filter((r) => !r.edition.isActive),
  );

  readonly showRegistrationLink = computed(() => {
    const edition = this.activeEdition();
    return !!edition && edition.registrationOpen && edition.isVisible;
  });

  constructor() {
    this.registrationService.getMine().subscribe({
      next: (regs) => {
        this.registrations.set(regs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  statusLabel(status: RegistrationSummary['status']): string {
    const labels: Record<RegistrationSummary['status'], string> = {
      submitted: 'En cours d\'étude',
      accepted: 'Acceptée',
      refused: 'Refusée / liste d\'attente',
      completed: 'Terminée',
      confirmed: 'Validée',
      draft: 'Brouillon',
      waitlisted: 'Liste d\'attente',
    };
    return labels[status];
  }

  goToHistory(reg: RegistrationSummary): void {
    this.router.navigate(['/mon-espace/historique', reg.id]);
  }

  goToWizard(): void {
    this.router.navigate(['/mon-espace/inscription']);
  }

  contact(): void {
    this.router.navigate(['/mon-espace/contact']);
  }
}
