import {
  ClubType,
  EditionRegistrationState,
  ExhibitorType,
  RegistrationStatus,
} from '../models/edition-form.models';

/**
 * MOCK — à remplacer par un appel au service Angular qui consommera :
 *   GET /api/registrations/by-edition-year/{year}
 * (le controller Symfony resterait fin, déléguant à un RegistrationService qui réutilise
 * AbstractRestService / AbstractRestRepository déjà en place).
 *
 * Pour cette itération front-only, on simule deux scénarios via une simple Map indexée par année :
 *  - "2030" : édition active, inscription en brouillon, formulaire éditable.
 *  - "2028" : édition passée, inscription terminée, formulaire en lecture seule et préremplie.
 */
const MOCK_REGISTRATIONS: Record<string, EditionRegistrationState> = {
  '2016': {
    editionYear: '2030',
    status: RegistrationStatus.DRAFT,
    readOnly: false,
    entity: {
      exhibitorType: ExhibitorType.PRO,
      companyName: '',
      siret: null,
      activityDomain: null,
      clubType: null,
      visualFileName: null,
      managers: [],
    },
    stand: {
      selectedSurfaceOptionId: null,
      quantitiesByOptionId: {},
    },
    confirmation: {
      checklist: {
        acknowledgedQuoteAndPricing: false,
        acceptedGeneralTerms: false,
        noSublease: false,
        noStandSharing: false,
        cleanupCommitment: false,
        respectLayout: false,
        readAndApproved: false,
      },
      signatoryName: '',
      signatoryRole: '',
      confirmedAt: null,
    },
    documents: [
      { id: 'doc-quote-1', kind: 'quote', label: 'Devis 2030', visible: true, fileUrl: '/mock/devis-2030.pdf', signed: false, uploadedAt: new Date('2029-11-04') },
    ],
    payment: {
      standTotalTtc: 0,
      discountPercent: 0,
      fileFeeTtc: 25,
      depositRatePercent: 30,
      balanceDueDate: new Date('2030-01-15'),
      payments: [],
    },
  },
  '2028': {
    editionYear: '2028',
    status: RegistrationStatus.COMPLETED,
    readOnly: true,
    entity: {
      exhibitorType: ExhibitorType.CLUB,
      companyName: 'RC Phoenix Miniatures',
      siret: null,
      activityDomain: null,
      clubType: ClubType.BRAND_MODEL,
      visualFileName: 'logo-rc-phoenix.png',
      managers: [
        { id: 'mgr-1', firstName: 'Jonathan', lastName: 'Petit', phone: '0612345678', email: 'jonathan.petit@example.com' },
      ],
    },
    stand: {
      selectedSurfaceOptionId: 'surface-25',
      quantitiesByOptionId: {
        'carpet-standard': 25,
        'electricity-3kw': 1,
      },
    },
    confirmation: {
      checklist: {
        acknowledgedQuoteAndPricing: true,
        acceptedGeneralTerms: true,
        noSublease: true,
        noStandSharing: true,
        cleanupCommitment: true,
        respectLayout: true,
        readAndApproved: true,
      },
      signatoryName: 'Jonathan Petit',
      signatoryRole: 'Président',
      confirmedAt: new Date('2027-09-12'),
    },
    documents: [
      { id: 'doc-quote-1', kind: 'quote', label: 'Devis 2028', visible: true, fileUrl: '/mock/devis-2028-signe.pdf', signed: true, uploadedAt: new Date('2027-09-01') },
      { id: 'doc-invoice-1', kind: 'invoice', label: 'Facture 2028', visible: true, fileUrl: '/mock/facture-2028.pdf', signed: false, uploadedAt: new Date('2027-09-15') },
      { id: 'doc-insurance-1', kind: 'insurance', label: 'Assurance RC', visible: true, fileUrl: '/mock/rc-2028.pdf', signed: false, uploadedAt: new Date('2027-10-02') },
      { id: 'doc-suppliers', kind: 'supplier_list', label: 'Liste fournisseurs agréés', visible: true, fileUrl: '/mock/fournisseurs-2028.pdf', signed: false, uploadedAt: new Date('2027-08-20') },
    ],
    payment: {
      standTotalTtc: 1885,
      discountPercent: 25,
      fileFeeTtc: 25,
      depositRatePercent: 30,
      balanceDueDate: new Date('2028-01-15'),
      payments: [
        { id: 'pay-1', amountTtc: 431.40, method: 'Carte bancaire', paidAt: new Date('2027-06-05') },
        { id: 'pay-2', amountTtc: 200, method: 'Virement', paidAt: new Date('2027-07-06') },
      ],
    },
  },
};

export function loadMockRegistration(editionYear: string): EditionRegistrationState | null {
  const mock = MOCK_REGISTRATIONS[editionYear];

  // Retourne une copie profonde : on ne veut jamais muter l'objet "base de données" mocké
  // depuis le state du composant (sinon une 2e visite afficherait l'état modifié de la 1re).
  return mock ? structuredClone(mock) : null;
}
