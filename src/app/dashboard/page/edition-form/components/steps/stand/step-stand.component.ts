import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { AccordionModule } from 'primeng/accordion';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputNumberModule } from 'primeng/inputnumber';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { getOptionsByCategory } from '@app/dashboard/services/options-catalog';
import { OPTION_CATEGORY_LABELS, OptionCategory } from '@app/dashboard/models/edition-form.models';

@Component({
  selector: 'app-step-stand',
  standalone: true,
  imports: [FormsModule, DecimalPipe, ButtonModule, AccordionModule, RadioButtonModule, InputNumberModule],
  templateUrl: './step-stand.component.html',
})
export class StepStandComponent {
  protected readonly formState = inject(EditionFormStateService);

  protected readonly surfaceOptions = getOptionsByCategory(OptionCategory.SURFACE);

  /** Catégories autres que la surface, affichées en accordéon avec quantité libre. */
  protected readonly addonCategories = Object.values(OptionCategory).filter(
    (category) => category !== OptionCategory.SURFACE,
  );

  protected categoryLabel(category: OptionCategory): string {
    return OPTION_CATEGORY_LABELS[category];
  }

  protected optionsForCategory(category: OptionCategory) {
    return getOptionsByCategory(category);
  }

  protected quantityFor(optionId: string): number {
    return this.formState.registration()?.stand.quantitiesByOptionId[optionId] ?? 0;
  }

  /**
   * TODO : remplace l'appel `nous contacter` générique par une navigation vers le même
   * formulaire de contact que le bouton "Nous contacter", avec objet pré-rempli
   * "Formulaire espace exposant — commande complémentaire" (cf. cahier des charges étape 2).
   */
  protected requestAdditionalOrder(): void {
    // no-op (front only)
  }
}
