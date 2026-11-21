import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CarpetColor, PreviousStandDto } from '@app/dashboard/models/previous-stand.models';

const CARPET_COLORS: Record<CarpetColor, { label: string; hex: string; light: boolean }> = {
  red: { label: 'Rouge', hex: '#DD0806', light: false },
  light_grey: { label: 'Gris clair', hex: '#C0C0C0', light: true },
  black: { label: 'Noir', hex: '#000000', light: false },
  blue: { label: 'Bleu', hex: '#00ABEA', light: false },
  sand: { label: 'Sable', hex: '#FFCC99', light: true },
};

/** Rappel, replié par défaut, du stand que l'exposant avait à l'édition précédente. */
@Component({
  selector: 'app-previous-stand-reminder',
  standalone: true,
  imports: [ButtonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './previous-stand-reminder.component.html',
})
export class PreviousStandReminderComponent {
  readonly stand = input.required<PreviousStandDto>();

  protected readonly expanded = signal(false);

  protected readonly carpet = computed(() => {
    const color = this.stand().carpetColor;
    return color ? CARPET_COLORS[color] : null;
  });

  protected readonly electricalLabel = computed(() => {
    const box = this.stand().electricalBox;
    if (box === 1) return 'Coffret';
    if (box === 0.5) return 'Compteur partagé';
    return 'Aucun';
  });

  protected toggle(): void {
    this.expanded.update((v) => !v);
  }
}
