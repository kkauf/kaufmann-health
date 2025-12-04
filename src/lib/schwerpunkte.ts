/**
 * Schwerpunkte (Focus Areas) Configuration
 * 
 * Categories are stored by ID in therapists.schwerpunkte (jsonb array of strings)
 * and people.metadata.schwerpunkte for client selections.
 * 
 * Keywords are for UI display/context only and not stored separately.
 */

export type SchwerpunktCategory = {
  id: string;
  label: string;
  keywords: string[];
  metaCategory: 'seelisch' | 'koerper' | 'beziehung' | 'lebenswege';
};

export type MetaCategory = {
  id: 'seelisch' | 'koerper' | 'beziehung' | 'lebenswege';
  label: string;
  icon: 'Heart' | 'Activity' | 'UsersRound' | 'Compass';
  color: {
    bg: string;
    text: string;
    border: string;
    iconBg: string;
  };
};

export const META_CATEGORIES: MetaCategory[] = [
  {
    id: 'seelisch',
    label: 'Seelische Belastung',
    icon: 'Heart',
    color: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      iconBg: 'bg-gradient-to-br from-rose-50 to-rose-100/60',
    },
  },
  {
    id: 'koerper',
    label: 'Körper & Verhalten',
    icon: 'Activity',
    color: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      iconBg: 'bg-gradient-to-br from-amber-50 to-amber-100/60',
    },
  },
  {
    id: 'beziehung',
    label: 'Beziehungen',
    icon: 'UsersRound',
    color: {
      bg: 'bg-sky-50',
      text: 'text-sky-700',
      border: 'border-sky-200',
      iconBg: 'bg-gradient-to-br from-sky-50 to-sky-100/60',
    },
  },
  {
    id: 'lebenswege',
    label: 'Lebenswege',
    icon: 'Compass',
    color: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      iconBg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/60',
    },
  },
];

export const SCHWERPUNKT_CATEGORIES: SchwerpunktCategory[] = [
  // === Seelische Belastung (5) ===
  {
    id: 'trauma',
    label: 'Trauma / PTBS',
    metaCategory: 'seelisch',
    keywords: [
      'Trauma',
      'Bindungstrauma',
      'Entwicklungstrauma',
      'Komplexe PTBS',
      'Schocktrauma',
      'Akutes Trauma',
      'Missbrauch',
      'Vernachlässigung',
    ],
  },
  {
    id: 'angst',
    label: 'Angst / Panik',
    metaCategory: 'seelisch',
    keywords: [
      'Angst',
      'Angststörung',
      'Panikattacken',
      'Verlustangst',
      'Innere Unruhe',
    ],
  },
  {
    id: 'depression',
    label: 'Depression / Erschöpfung',
    metaCategory: 'seelisch',
    keywords: [
      'Depression',
      'Depressive Verstimmung',
      'Burnout',
      'Erschöpfung',
      'Aussichtslosigkeit',
      'Überforderung',
      'Emotionale Taubheit',
      'Stimmungsschwankungen',
    ],
  },
  {
    id: 'selbstwert',
    label: 'Selbstwert / Scham',
    metaCategory: 'seelisch',
    keywords: [
      'Geringes Selbstwertgefühl',
      'Selbstkritik / Innerer Kritiker',
      'Scham',
      'Schuldgefühle',
      'Perfektionismus',
      'People Pleasing',
    ],
  },
  {
    id: 'trauer',
    label: 'Trauer / Verlust',
    metaCategory: 'seelisch',
    keywords: ['Trauer', 'Verlust', 'Lebenskrise'],
  },
  // === Körper & Verhalten (5) ===
  {
    id: 'psychosomatik',
    label: 'Psychosomatik / Körper',
    metaCategory: 'koerper',
    keywords: [
      'Psychosomatische Beschwerden',
      'Chronische Schmerzen',
      'Verspannungen',
      'Rückenschmerzen',
      'Kopfschmerzen / Migräne',
      'Schlafstörungen',
      'Erschöpfungssyndrom',
      'Verdauungsbeschwerden',
      'Dissoziative Symptome',
    ],
  },
  {
    id: 'essstoerung',
    label: 'Essstörungen / Körperbild',
    metaCategory: 'koerper',
    keywords: [
      'Essstörungen',
      'Anorexie',
      'Bulimie',
      'Binge Eating',
      'Körperbild',
      'Emotionales Essen',
    ],
  },
  {
    id: 'wut',
    label: 'Wut / Emotionsregulation',
    metaCategory: 'koerper',
    keywords: ['Wut', 'Aggression', 'Impulskontrolle', 'Überwältigung'],
  },
  {
    id: 'zwang',
    label: 'Kontrolle / Zwang',
    metaCategory: 'koerper',
    keywords: ['Zwangsgedanken', 'Kontrollthemen', 'Hypochondrie'],
  },
  {
    id: 'sexualitaet',
    label: 'Sexualität',
    metaCategory: 'koerper',
    keywords: [
      'Sexuelle Probleme',
      'Sexuelles Trauma',
      'Lustlosigkeit',
      'Körperliche Blockaden bei Intimität',
    ],
  },
  // === Beziehungen (2) ===
  {
    id: 'beziehung',
    label: 'Beziehungsprobleme',
    metaCategory: 'beziehung',
    keywords: [
      'Beziehungsprobleme',
      'Trennung',
      'Emotionale Abhängigkeit',
      'Bindungsangst',
      'Nähe-Distanz-Probleme',
      'Co-Abhängigkeit',
      'Einsamkeit',
      'Schwierigkeiten mit Grenzen setzen',
    ],
  },
  {
    id: 'paare',
    label: 'Paare / Familie',
    metaCategory: 'beziehung',
    keywords: [
      'Paartherapie',
      'Kommunikation in Beziehungen',
      'Familienkonflikte',
      'Elternschaft',
    ],
  },
  // === Lebenswege (4) ===
  {
    id: 'krisen',
    label: 'Krisen',
    metaCategory: 'lebenswege',
    keywords: [
      'Krisenintervention',
      'Suizidalität',
      'Akute Belastungsreaktion',
      'Notfallbegleitung',
    ],
  },
  {
    id: 'identitaet',
    label: 'Identität',
    metaCategory: 'lebenswege',
    keywords: [
      'Identitätsfragen',
      'Geschlechtsidentität',
      'LGBTQ+',
      'Migration / Expat-Themen',
      'Kulturelle Identität',
    ],
  },
  {
    id: 'neurodivergenz',
    label: 'ADHS / Autismus',
    metaCategory: 'lebenswege',
    keywords: ['ADHS', 'Autismus / Autismus-Spektrum', 'Hochsensibilität (HSP)'],
  },
  {
    id: 'entwicklung',
    label: 'Persönliche Entwicklung',
    metaCategory: 'lebenswege',
    keywords: [
      'Selbstbewusstsein',
      'Persönlichkeitsentwicklung',
      'Karriere',
      'Berufliche Neuorientierung',
      'Lebensübergänge',
      'Sinnfragen',
      'Stress',
      'Work-Life-Balance',
    ],
  },
];

// Validation constants
export const THERAPIST_SCHWERPUNKTE_MIN = 1;
export const THERAPIST_SCHWERPUNKTE_MAX = 5;
export const CLIENT_SCHWERPUNKTE_MIN = 1;
export const CLIENT_SCHWERPUNKTE_MAX = 3;

// Helper functions
export function getSchwerpunktById(id: string): SchwerpunktCategory | undefined {
  return SCHWERPUNKT_CATEGORIES.find((c) => c.id === id);
}

export function getSchwerpunktLabel(id: string): string {
  return getSchwerpunktById(id)?.label ?? id;
}

export function isValidSchwerpunktId(id: string): boolean {
  return SCHWERPUNKT_CATEGORIES.some((c) => c.id === id);
}

export function validateSchwerpunkte(
  ids: string[],
  role: 'therapist' | 'client'
): { valid: boolean; error?: string } {
  const min = role === 'therapist' ? THERAPIST_SCHWERPUNKTE_MIN : CLIENT_SCHWERPUNKTE_MIN;
  const max = role === 'therapist' ? THERAPIST_SCHWERPUNKTE_MAX : CLIENT_SCHWERPUNKTE_MAX;

  if (ids.length < min) {
    return { valid: false, error: `Mindestens ${min} Schwerpunkt${min > 1 ? 'e' : ''} erforderlich` };
  }
  if (ids.length > max) {
    return { valid: false, error: `Maximal ${max} Schwerpunkte erlaubt` };
  }

  const invalidIds = ids.filter((id) => !isValidSchwerpunktId(id));
  if (invalidIds.length > 0) {
    return { valid: false, error: `Ungültige Schwerpunkte: ${invalidIds.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Calculate match score between client and therapist schwerpunkte
 * Returns number of overlapping categories
 */
export function calculateSchwerpunkteOverlap(
  clientSchwerpunkte: string[],
  therapistSchwerpunkte: string[]
): number {
  const clientSet = new Set(clientSchwerpunkte);
  return therapistSchwerpunkte.filter((id) => clientSet.has(id)).length;
}

/**
 * Get all categories for a meta-category
 */
export function getCategoriesByMeta(metaId: MetaCategory['id']): SchwerpunktCategory[] {
  return SCHWERPUNKT_CATEGORIES.filter((c) => c.metaCategory === metaId);
}

/**
 * Get meta-category info by ID
 */
export function getMetaCategoryById(id: MetaCategory['id']): MetaCategory | undefined {
  return META_CATEGORIES.find((m) => m.id === id);
}
