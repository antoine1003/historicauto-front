import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { PARTITION_LAYOUT_LABELS, StandLine } from '@app/dashboard/models/edition-form.models';

interface RecapSection {
  groupLabel: string;
  lines: StandLine[];
}

/**
 * Récapitulatif chiffré des options retenues.
 *
 * Composant de présentation pur : il n'injecte aucun service d'état et n'effectue aucun calcul de
 * prix — les lignes et les totaux arrivent déjà calculés par le serveur. C'est ce qui lui permet
 * d'être réutilisé tel quel à l'étape 2 et à l'étape 5.
 */
@Component({
  selector: 'app-options-recap',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './options-recap.component.html',
})
export class OptionsRecapComponent {
  readonly lines = input.required<StandLine[]>();
  readonly totalTtc = input.required<number>();
  readonly totalVat = input.required<number>();
  readonly depositTtc = input.required<number>();
  readonly title = input<string>('Détail de votre commande');

  /**
   * Regroupe les lignes consécutives partageant la même section. Les lignes arrivent déjà
   * ordonnées par section puis par option, donc un simple parcours suffit — inutile de trier.
   */
  protected readonly sections = computed<RecapSection[]>(() => {
    const sections: RecapSection[] = [];

    for (const line of this.lines()) {
      const current = sections[sections.length - 1];
      if (current && current.groupLabel === line.groupLabel) {
        current.lines.push(line);
      } else {
        sections.push({ groupLabel: line.groupLabel, lines: [line] });
      }
    }

    return sections;
  });

  protected partitionSummary(line: StandLine): string | null {
    if (line.partition === null) {
      return null;
    }

    const layout = PARTITION_LAYOUT_LABELS[line.partition.layout];
    const segments = line.partition.segments.map((length) => `${length} m`).join(' + ');

    return `${layout} — ${segments}`;
  }
}
