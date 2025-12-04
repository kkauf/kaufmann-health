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
};

export const SCHWERPUNKT_CATEGORIES: SchwerpunktCategory[] = [
  {
    id: 'trauma',
    label: 'Trauma / PTBS',
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
    id: 'beziehung',
    label: 'Beziehungsprobleme',
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
    id: 'wut',
    label: 'Wut / Emotionsregulation',
    keywords: ['Wut', 'Aggression', 'Impulskontrolle', 'Überwältigung'],
  },
  {
    id: 'psychosomatik',
    label: 'Psychosomatik / Körper',
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
    id: 'trauer',
    label: 'Trauer / Verlust',
    keywords: ['Trauer', 'Verlust', 'Lebenskrise'],
  },
  {
    id: 'selbstwert',
    label: 'Selbstwert / Scham',
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
    id: 'zwang',
    label: 'Kontrolle / Zwang',
    keywords: ['Zwangsgedanken', 'Kontrollthemen', 'Hypochondrie'],
  },
  {
    id: 'neurodivergenz',
    label: 'ADHS / Autismus',
    keywords: ['ADHS', 'Autismus / Autismus-Spektrum', 'Hochsensibilität (HSP)'],
  },
  {
    id: 'sexualitaet',
    label: 'Sexualität',
    keywords: [
      'Sexuelle Probleme',
      'Sexuelles Trauma',
      'Lustlosigkeit',
      'Körperliche Blockaden bei Intimität',
    ],
  },
  {
    id: 'krisen',
    label: 'Krisen',
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
    keywords: [
      'Identitätsfragen',
      'Geschlechtsidentität',
      'LGBTQ+',
      'Migration / Expat-Themen',
      'Kulturelle Identität',
    ],
  },
  {
    id: 'paare',
    label: 'Paare / Familie',
    keywords: [
      'Paartherapie',
      'Kommunikation in Beziehungen',
      'Familienkonflikte',
      'Elternschaft',
    ],
  },
  {
    id: 'entwicklung',
    label: 'Persönliche Entwicklung',
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
