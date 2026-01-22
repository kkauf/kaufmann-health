/**
 * Central configuration for all therapy modalities
 * Used for SEO, filtering, and consistent UI across modality pages
 */

export type ModalityId = 'narm' | 'somatic-experiencing' | 'hakomi' | 'core-energetics';

export interface ModalityConfig {
  id: ModalityId;
  name: string;
  fullName: string;
  slug: string;
  
  // SEO
  metaTitle: string;
  metaDescription: string;
  
  // Therapist filtering
  therapistFilter: {
    modalities: string[];
  };
  
  // For "Alle Therapeut:innen ansehen" button → /therapeuten with pre-filter
  directoryFilterParams: string;
  
  // Display
  therapistSectionTitle: string;
  therapistSectionSubtitle: string;
}

export const MODALITIES: Record<ModalityId, ModalityConfig> = {
  'narm': {
    id: 'narm',
    name: 'NARM',
    fullName: 'NeuroAffektives Beziehungsmodell',
    slug: 'narm',
    metaTitle: 'NARM Therapie Berlin | Entwicklungstrauma heilen',
    metaDescription: 'NARM (NeuroAffektives Beziehungsmodell) für Entwicklungstrauma in Berlin & online. Ohne Retraumatisierung zu mehr Selbstregulation. Zertifizierte Therapeut:innen finden.',
    therapistFilter: {
      modalities: ['narm'],
    },
    directoryFilterParams: '?modality=narm',
    therapistSectionTitle: 'Unsere NARM-Therapeut:innen',
    therapistSectionSubtitle: 'Zertifiziert in NeuroAffektivem Beziehungsmodell – für Entwicklungstrauma',
  },
  
  'somatic-experiencing': {
    id: 'somatic-experiencing',
    name: 'Somatic Experiencing',
    fullName: 'Somatic Experiencing (SE)',
    slug: 'somatic-experiencing',
    metaTitle: 'Somatic Experiencing (SE) Berlin | Traumatherapie nach Peter Levine',
    metaDescription: 'Somatic Experiencing (SE) löst Trauma über das Nervensystem – sanft, sicher, evidenzbasiert. Zertifizierte SE-Praktiker:innen in Berlin & online finden.',
    therapistFilter: {
      modalities: ['somatic-experiencing'],
    },
    directoryFilterParams: '?modality=somatic-experiencing',
    therapistSectionTitle: 'Unsere Somatic Experiencing Therapeut:innen',
    therapistSectionSubtitle: 'Zertifizierte SE-Praktiker:innen (SEP) – nach Dr. Peter Levine',
  },
  
  'hakomi': {
    id: 'hakomi',
    name: 'Hakomi',
    fullName: 'Hakomi-Methode',
    slug: 'hakomi',
    metaTitle: 'Hakomi Therapie Berlin | Achtsamkeitsbasierte Körperpsychotherapie',
    metaDescription: 'Hakomi-Methode: Achtsamkeitsbasierte Körperpsychotherapie in Berlin & online. Sanft, achtsam, transformativ. Zertifizierte Hakomi-Therapeut:innen finden.',
    therapistFilter: {
      modalities: ['hakomi'],
    },
    directoryFilterParams: '?modality=hakomi',
    therapistSectionTitle: 'Unsere Hakomi-Therapeut:innen',
    therapistSectionSubtitle: 'Zertifiziert in achtsamkeitsbasierter Körperpsychotherapie',
  },
  
  'core-energetics': {
    id: 'core-energetics',
    name: 'Core Energetics',
    fullName: 'Core Energetics',
    slug: 'core-energetics',
    metaTitle: 'Core Energetics Therapie Berlin | Körperorientierte Charakterarbeit',
    metaDescription: 'Core Energetics: Tiefenpsychologische Körpertherapie nach John Pierrakos in Berlin & online. Charakterstrukturen lösen. Zertifizierte Core Energetics Therapeut:innen.',
    therapistFilter: {
      modalities: ['core-energetics'],
    },
    directoryFilterParams: '?modality=core-energetics',
    therapistSectionTitle: 'Unsere Core Energetics Therapeut:innen',
    therapistSectionSubtitle: 'Zertifiziert in körperorientierter Charakterarbeit',
  },
};

/**
 * Get modality config by slug
 */
export function getModalityBySlug(slug: string): ModalityConfig | undefined {
  return Object.values(MODALITIES).find(m => m.slug === slug);
}

/**
 * Get all modality slugs for static generation
 */
export function getAllModalitySlugs(): string[] {
  return Object.values(MODALITIES).map(m => m.slug);
}
