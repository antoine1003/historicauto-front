import { OptionCategory, OptionDefinition } from '../models/edition-form.models';

/**
 * Catalogue des options, en dur côté front comme demandé.
 *
 * RECOMMANDATION SENIOR : ne stocker en dur que ce qui est structurel (id, libellé, catégorie,
 * unité, badges inclus). Le prix (mockPriceTtc/mockVatRate ci-dessous) doit être remplacé par un
 * appel à l'API au chargement de la page formulaire :
 *
 *   GET /api/editions/{year}/option-prices  →  Map<optionId, { priceTtc, vatRate, includedBadges }>
 *
 * puis fusionné avec ce catalogue (le catalogue donne le "quoi", l'API donne le "combien").
 * Cela évite une redéploiement front à chaque changement de tarif d'une édition.
 */
export const OPTIONS_CATALOG: OptionDefinition[] = [
  // --- SURFACE : packs exclusifs (sélection unique), surface + badges inclus ---
  { id: 'surface-09', category: OptionCategory.SURFACE, label: '9 m² (3x3 m) — 2 badges exposants', unit: 'm²', includedBadges: 2, mockPriceTtc: 108, mockVatRate: 0.10 },
  { id: 'surface-12', category: OptionCategory.SURFACE, label: '12 m² (4x3 m) — 2 badges exposants', unit: 'm²', includedBadges: 2, mockPriceTtc: 144, mockVatRate: 0.10 },
  { id: 'surface-15', category: OptionCategory.SURFACE, label: '15 m² (5x3 m) — 2 badges exposants', unit: 'm²', includedBadges: 2, mockPriceTtc: 180, mockVatRate: 0.10 },
  { id: 'surface-16', category: OptionCategory.SURFACE, label: '16 m² (4x4 m) — 2 badges exposants', unit: 'm²', includedBadges: 2, mockPriceTtc: 192, mockVatRate: 0.10 },
  { id: 'surface-18', category: OptionCategory.SURFACE, label: '18 m² (6x3 m) — 2 badges exposants', unit: 'm²', includedBadges: 2, mockPriceTtc: 216, mockVatRate: 0.10 },
  { id: 'surface-20', category: OptionCategory.SURFACE, label: '20 m² (5x4 m) — 2 badges exposants', unit: 'm²', includedBadges: 2, mockPriceTtc: 240, mockVatRate: 0.10 },
  { id: 'surface-24', category: OptionCategory.SURFACE, label: '24 m² (6x4 m) — 3 badges exposants', unit: 'm²', includedBadges: 3, mockPriceTtc: 288, mockVatRate: 0.10 },
  { id: 'surface-25', category: OptionCategory.SURFACE, label: '25 m² (5x5 m) — 3 badges exposants', unit: 'm²', includedBadges: 3, mockPriceTtc: 300, mockVatRate: 0.10 },
  { id: 'surface-30', category: OptionCategory.SURFACE, label: '30 m² (6x5 m) — 3 badges exposants', unit: 'm²', includedBadges: 3, mockPriceTtc: 360, mockVatRate: 0.10 },
  { id: 'surface-36', category: OptionCategory.SURFACE, label: '36 m² (6x6 m) — 3 badges exposants', unit: 'm²', includedBadges: 3, mockPriceTtc: 432, mockVatRate: 0.10 },
  { id: 'surface-45', category: OptionCategory.SURFACE, label: '45 m² (9x5 m) — 3 badges exposants', unit: 'm²', includedBadges: 3, mockPriceTtc: 540, mockVatRate: 0.10 },
  { id: 'surface-54', category: OptionCategory.SURFACE, label: '54 m² (9x6 m) — 4 badges exposants', unit: 'm²', includedBadges: 4, mockPriceTtc: 648, mockVatRate: 0.10 },

  // --- CARPET ---
  { id: 'carpet-standard', category: OptionCategory.CARPET, label: 'Moquette standard (au m²)', unit: 'm²', includedBadges: null, mockPriceTtc: 8, mockVatRate: 0.20 },
  { id: 'carpet-premium', category: OptionCategory.CARPET, label: 'Moquette premium (au m²)', unit: 'm²', includedBadges: null, mockPriceTtc: 14, mockVatRate: 0.20 },

  // --- PARTITION ---
  { id: 'partition-ml', category: OptionCategory.PARTITION, label: 'Cloison modulaire (au mètre linéaire)', unit: 'ml', includedBadges: null, mockPriceTtc: 22, mockVatRate: 0.20 },

  // --- STORAGE ---
  { id: 'storage-2m2', category: OptionCategory.STORAGE, label: 'Réserve fermée 2 m²', unit: null, includedBadges: null, mockPriceTtc: 90, mockVatRate: 0.20 },

  // --- ELECTRICITY ---
  { id: 'electricity-3kw', category: OptionCategory.ELECTRICITY, label: 'Branchement électrique 3 kW', unit: null, includedBadges: null, mockPriceTtc: 65, mockVatRate: 0.20 },
  { id: 'electricity-6kw', category: OptionCategory.ELECTRICITY, label: 'Branchement électrique 6 kW', unit: null, includedBadges: null, mockPriceTtc: 110, mockVatRate: 0.20 },

  // --- LIGHTING ---
  { id: 'lighting-spot', category: OptionCategory.LIGHTING, label: 'Spot orientable supplémentaire', unit: 'pièce', includedBadges: null, mockPriceTtc: 18, mockVatRate: 0.20 },

  // --- BARRIER ---
  { id: 'barrier-ml', category: OptionCategory.BARRIER, label: 'Barriérage (au mètre linéaire)', unit: 'ml', includedBadges: null, mockPriceTtc: 12, mockVatRate: 0.20 },

  // --- ACCESS ---
  { id: 'access-parking', category: OptionCategory.ACCESS, label: 'Sticker pare-brise parking exposant supplémentaire', unit: 'pièce', includedBadges: null, mockPriceTtc: 15, mockVatRate: 0.20 },

  // --- STRUCTURE ---
  { id: 'structure-barnum-3x3', category: OptionCategory.STRUCTURE, label: 'Barnum 3x3 m', unit: null, includedBadges: null, mockPriceTtc: 250, mockVatRate: 0.20 },
];

export function getOptionById(id: string): OptionDefinition | undefined {
  return OPTIONS_CATALOG.find((option) => option.id === id);
}

export function getOptionsByCategory(category: OptionCategory): OptionDefinition[] {
  return OPTIONS_CATALOG.filter((option) => option.category === category);
}
