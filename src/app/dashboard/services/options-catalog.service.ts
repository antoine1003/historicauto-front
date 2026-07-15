import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '@app/core/models/api.models';
import { OptionPriceApiDto } from '../models/registration-api.models';
import { ExhibitorType, OptionCategory, OptionDefinition } from '../models/edition-form.models';

@Injectable({ providedIn: 'root' })
export class OptionsCatalogService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<OptionDefinition[]>>();

  /**
   * Récupère le catalogue d'options + tarifs pour une édition, mis en cache par année : plusieurs
   * appels successifs (ex: navigation entre étapes du même formulaire) ne déclenchent qu'une seule
   * requête réseau.
   */
  getForEdition(year: string): Observable<OptionDefinition[]> {
    let cached = this.cache.get(year);
    if (!cached) {
      cached = this.http
        .get<ApiResponse<OptionPriceApiDto[]>>(`${environment.apiUrl}/editions/${year}/option-prices`)
        .pipe(
          map((res) => res.data.map(toOptionDefinition)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
      this.cache.set(year, cached);
    }

    return cached;
  }
}

function toOptionDefinition(dto: OptionPriceApiDto): OptionDefinition {
  return {
    id: dto.optionId,
    category: dto.category as OptionCategory,
    label: dto.label,
    unit: dto.unit,
    includedBadges: dto.includedBadges,
    exhibitorType: dto.exhibitorType as ExhibitorType | null,
    priceTtc: dto.priceTtc,
    vatRate: dto.vatRate,
  };
}
