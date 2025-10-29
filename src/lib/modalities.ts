import type { LucideIcon } from 'lucide-react';
import { HeartHandshake, Shell, Wind, Target } from 'lucide-react';

export interface ModalityInfo {
  id: string;
  label: string;
  subtitle?: string;
  description: string;
  cls: string;
  Icon: LucideIcon;
}

export const MODALITY_DATA: Record<string, ModalityInfo> = {
  'narm': {
    id: 'narm',
    label: 'NARM',
    subtitle: 'Neuroaffektives Beziehungsmodell',
    description: 'NARM fokussiert auf Entwicklungstraumata und die Fähigkeit zur Selbstregulation. Der Ansatz verbindet achtsame Körperwahrnehmung mit der Arbeit an Mustern in Beziehungen – ohne re-traumatisierende Detailschilderungen.',
    cls: 'border-teal-200 bg-teal-50 text-teal-800 hover:border-teal-300 hover:bg-teal-100',
    Icon: HeartHandshake,
  },
  'somatic-experiencing': {
    id: 'somatic-experiencing',
    label: 'Somatic Experiencing',
    subtitle: '(SE)',
    description: 'SE arbeitet mit der natürlichen Stressreaktion des Körpers. Durch fein dosierte Annäherung an belastende Empfindungen wird das Nervensystem behutsam entladen, sodass festgehaltene Energie wieder in Fluss kommt.',
    cls: 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100',
    Icon: Shell,
  },
  'hakomi': {
    id: 'hakomi',
    label: 'Hakomi',
    description: 'Hakomi ist eine achtsamkeitsbasierte Methode, die unbewusste Muster über den Körper erfahrbar macht. In respektvoller, langsamer Arbeit entstehen neue Erfahrungen, die alte Überzeugungen sanft verändern.',
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100',
    Icon: Wind,
  },
  'core-energetics': {
    id: 'core-energetics',
    label: 'Core Energetics',
    description: 'Core Energetics verbindet körperliche Ausdrucksarbeit mit emotionaler Integration. Über Haltung, Atmung und Bewegung werden festgehaltene Spannungen gelöst und Lebendigkeit sowie Kontaktfähigkeit gestärkt.',
    cls: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 hover:border-fuchsia-300 hover:bg-fuchsia-100',
    Icon: Target,
  },
};

export function normalizeModality(m: string): string {
  return m.toLowerCase().replace(/\s+/g, '-');
}

export function getModalityInfo(modality: string): ModalityInfo {
  const normalized = normalizeModality(modality);
  return MODALITY_DATA[normalized] || {
    id: normalized,
    label: modality,
    description: '',
    cls: 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-slate-100',
    Icon: Target,
  };
}
