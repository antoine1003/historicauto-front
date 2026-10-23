import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';
import { DEFAULT_HOME_CONTENT } from '@app/public/models/home-content.model';
import { HomeContentService } from '@app/public/services/home-content.service';
import { map, timer } from 'rxjs';

/** En dessous, le contenu arrive sans que l'on montre d'attente (pas de clignotement). */
const SKELETON_DELAY_MS = 300;

interface HomeStep {
  readonly index: string;
  readonly title: string;
  readonly text: string;
}

/** Morceau de texte, à afficher en exposant ou non. */
interface TextPart {
  readonly text: string;
  readonly sup: boolean;
}

/**
 * « 6e édition » → « 6 » + exposant « e ». Couvre 1er/1re/2e…, sans HTML saisi : le texte reste
 * du texte brut venu de l'administration.
 */
function withOrdinals(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(/(\d+)(er|re|e)(?![\p{L}\d])/gu)) {
    const suffixStart = m.index + m[1].length;
    parts.push({ text: text.slice(last, suffixStart), sup: false });
    parts.push({ text: m[2], sup: true });
    last = suffixStart + m[2].length;
  }
  parts.push({ text: text.slice(last), sup: false });
  return parts.filter((p) => p.text !== '');
}

/**
 * Page de présentation publique. Textes, images et chiffres viennent de l'administration
 * (`HomeContentService`) ; `AuthService` adapte l'intitulé et la cible des appels à l'action.
 *
 * Pendant le chargement, le contenu d'origine est rendu invisible pour réserver la place, et les
 * images ne sont pas encore demandées : la page ne montre jamais un texte puis un autre. Au-delà de
 * 300 ms, ce même texte devient des barres animées (squelettes) de la taille des lignes finales.
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

  private readonly loaded = toSignal(inject(HomeContentService).get());

  protected readonly isLoading = computed(() => this.loaded() === undefined);

  /** Passé ce délai sans réponse, le texte invisible laisse place aux squelettes animés. */
  private readonly slow = toSignal(timer(SKELETON_DELAY_MS).pipe(map(() => true)), { initialValue: false });

  /** Chargement court : rien n'est montré. Chargement long : squelettes. */
  protected readonly isHidden = computed(() => this.isLoading() && !this.slow());
  protected readonly isSkeleton = computed(() => this.isLoading() && this.slow());
  protected readonly content = computed(() => this.loaded() ?? DEFAULT_HOME_CONTENT);

  protected readonly heroTitle = computed(() => withOrdinals(this.content().heroTitle));
  protected readonly bandSubtitle = computed(() => withOrdinals(this.content().bandSubtitle));

  protected readonly heroImageUrl = computed(() => this.content().heroImageUrl ?? '/images/hero.jpg');
  protected readonly salonImageUrl = computed(() => this.content().salonImageUrl ?? '/images/salon.jpg');

  /**
   * Reprend à l'identique, et dans le même ordre, le stepper réel de
   * `edition-form-page.component.html` : Entité, Stand, Confirmation, Documents, Paiement.
   * Si ce stepper change, cette liste doit changer avec lui. Volontairement absente de
   * l'administration, pour que la page ne puisse pas décrire un autre parcours que le vrai.
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
