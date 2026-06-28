// src/app/features/mon-espace/pages/mon-espace-home/mon-espace-home.component.ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { RegistrationService } from '../../../shared/services/registration.service';
import { RegistrationSummary } from '@app/core/models/registration.model';
import { EditionService } from '@app/shared/services/edition.service';
import { finalize, forkJoin } from 'rxjs';
import { Edition } from '@app/shared/models/edition.interface';
import { JsonPipe } from '@angular/common';
import { Card } from 'primeng/card';

@Component({
  selector: 'app-mon-espace-home',
  standalone: true,
  imports: [ButtonModule, JsonPipe, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mon-espace-home.component.html',
})
export class MonEspaceHomeComponent {
  private readonly registrationService = inject(RegistrationService);
  private readonly editionService = inject(EditionService);
  private readonly router = inject(Router);

  private readonly registrations = signal<RegistrationSummary[]>([]);
  readonly loading = signal(true);
  readonly activeEdition = signal<Edition | null>(null);


  readonly currentRegistration = computed(() =>
    this.registrations()?.find((r) => r.edition.isActive) ?? null,
  );

  readonly pastRegistrations = computed(() =>
    this.registrations()?.filter((r) => !r.edition.isActive) ?? [],
  );


  readonly showRegistrationLink = computed(() => {
    const edition = this.activeEdition();
    return !!edition && edition.registrationOpen && edition.isVisible;
  });

  constructor() {
    forkJoin({
      mineResp: this.registrationService.getMine(),
      activeEditionResp: this.editionService.getActive(),
    }).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe(({mineResp, activeEditionResp}) => {
      this.registrations.set(mineResp.data);
      this.activeEdition.set(activeEditionResp.data);
    })
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
    void this.router.navigate(['/mon-espace/historique', reg.id]);
  }

  goToWizard(): void {
    void this.router.navigate(['/mon-espace/inscription']);
  }

  contact(): void {
    void this.router.navigate(['/mon-espace/contact']);
  }
}
