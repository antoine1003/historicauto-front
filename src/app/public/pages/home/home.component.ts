import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';

interface HomeStat {
  readonly value: string;
  readonly label: string;
}

interface HomeStep {
  readonly index: string;
  readonly title: string;
  readonly text: string;
}

/**
 * Page de présentation publique. Purement présentationnelle : sa seule dépendance est
 * `AuthService`, utilisé pour adapter l'intitulé et la cible des appels à l'action.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
})
export class HomeComponent {
  protected readonly auth = inject(AuthService);

  /** Chiffres publiés par historic-auto.com/histoire. Ne pas en ajouter d'autres sans source. */
  protected readonly stats: readonly HomeStat[] = [
    { value: '40 000', label: 'visiteurs' },
    { value: '330', label: 'exposants' },
    { value: '27 000 m²', label: 'de surface' },
    { value: '30', label: 'expositions thématiques' },
  ];

  /**
   * Reprend à l'identique, et dans le même ordre, le stepper réel de
   * `edition-form-page.component.html` : Entité, Stand, Confirmation, Documents, Paiement.
   * Si ce stepper change, cette liste doit changer avec lui.
   */
  protected readonly steps: readonly HomeStep[] = [
    {
      index: '01',
      title: 'Entité',
      text: "Renseignez votre raison sociale, votre domaine d'activité et les responsables présents sur le stand.",
    },
    {
      index: '02',
      title: 'Stand',
      text: 'Choisissez votre surface, puis ajoutez les options complémentaires dont vous avez besoin.',
    },
    {
      index: '03',
      title: 'Confirmation',
      text: 'Consultez votre devis, validez la checklist et confirmez votre participation.',
    },
    {
      index: '04',
      title: 'Documents',
      text: "Déposez vos pièces justificatives et votre attestation d'assurance RC, et retrouvez les documents communs à l'édition.",
    },
    {
      index: '05',
      title: 'Paiement',
      text: 'Consultez le récapitulatif financier, suivez vos paiements enregistrés et réglez en ligne.',
    },
  ];
}
