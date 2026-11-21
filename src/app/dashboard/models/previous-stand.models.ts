export type CarpetColor = 'red' | 'light_grey' | 'black' | 'blue' | 'sand';

/** Stand d'une édition précédente, tel que renvoyé par GET /api/previous-stands. */
export interface PreviousStandDto {
  id: string;
  type: 'CLUB' | 'PRO';
  standName: string;
  surfaceSqm: number;
  dimensions: string;
  carpetSqm: number;
  carpetColor: CarpetColor | null;
  /** 0 = aucun, 0.5 = compteur partagé, 1 = coffret. */
  electricalBox: number;
  partitionDetail: string | null;
  partitionTotalM: number;
  edition: string;
}

/** Suggestion de l'autocomplétion : `value` est requis par p-autocomplete (sans `optionValue`) pour garder le texte saisi. */
export type StandSuggestion = PreviousStandDto & { value: string };

/**
 * Normalise un nom de stand pour la comparaison, avec les mêmes règles que le back
 * (`u()->ascii()->lower()` + espaces compactés) : sans accents ni casse, ligatures développées.
 */
export function normalizeStandName(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[’‘]/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
