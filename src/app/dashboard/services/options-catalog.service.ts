import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '@app/core/models/api.models';
import { OptionGroupApiDto, OptionPriceApiDto } from '../models/registration-api.models';
import {
  OptionDefinition,
  OptionGroupBehaviour,
  OptionGroupDefinition,
  OptionInputType,
  OptionQuantitySource,
} from '../models/edition-form.models';

@Injectable({ providedIn: 'root' })
export class OptionsCatalogService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<OptionGroupDefinition[]>>();

  /**
   * Récupère les sections d'options + tarifs pour une édition, mis en cache par année : plusieurs
   * appels successifs (ex: navigation entre étapes du même formulaire) ne déclenchent qu'une seule
   * requête réseau. Le filtrage Pro/Club est fait côté serveur, le client n'a plus à le connaître.
   */
  getForEdition(year: string): Observable<OptionGroupDefinition[]> {
    let cached = this.cache.get(year);
    if (!cached) {
      cached = this.http
        .get<ApiResponse<OptionGroupApiDto[]>>(`${environment.apiUrl}/editions/${year}/option-prices`)
        .pipe(
          map((res) => res.data.map(toOptionGroupDefinition)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
      this.cache.set(year, cached);
    }

    return cached;
  }

  /**
   * Oublie le catalogue mis en cache pour une édition. Le catalogue dépend du type d'exposant
   * (packs de surface Pro et Club distincts) : à rappeler quand ce type change.
   */
  invalidate(year: string): void {
    this.cache.delete(year);
  }
}

function toOptionGroupDefinition(dto: OptionGroupApiDto): OptionGroupDefinition {
  return {
    code: dto.code,
    label: dto.label,
    helpText: dto.helpText,
    inputType: dto.inputType as OptionInputType,
    isRequired: dto.isRequired,
    quantitySource: dto.quantitySource as OptionQuantitySource,
    behaviour: dto.behaviour as OptionGroupBehaviour,
    sortOrder: dto.sortOrder,
    collapsedByDefault: dto.collapsedByDefault,
    options: dto.options.map(toOptionDefinition),
  };
}

function toOptionDefinition(dto: OptionPriceApiDto): OptionDefinition {
  return {
    id: dto.optionId,
    label: dto.label,
    unit: dto.unit,
    surfaceSqm: dto.surfaceSqm,
    includedBadges: dto.includedBadges,
    priceTtc: dto.priceTtc,
    vatRate: dto.vatRate,
    sortOrder: dto.sortOrder,
  };
}
