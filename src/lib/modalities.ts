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
    description: 'NARM ist ein therapeutischer Ansatz für Entwicklungstrauma — frühe Verletzungen, die unsere Beziehungs- und Regulationsfähigkeit geprägt haben. In der Arbeit verbinden sich Gespräch und Körperwahrnehmung, um alte Überlebensmuster zu erkennen und zu verändern. Ohne belastende Detailschilderungen.',
    cls: 'border-teal-200 bg-teal-50 text-teal-800 hover:border-teal-300 hover:bg-teal-100',
    Icon: HeartHandshake,
  },
  'somatic-experiencing': {
    id: 'somatic-experiencing',
    label: 'Somatic Experiencing',
    subtitle: '(SE)',
    description: 'SE ist eine körperorientierte Traumatherapie, die auf der Neurobiologie von Stress aufbaut. Der Ansatz hilft, im Nervensystem gebundene Stressreaktionen schrittweise zu lösen — besonders bei Schock, Unfällen oder chronischer Überforderung. Die Arbeit erfolgt behutsam und im eigenen Tempo.',
    cls: 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100',
    Icon: Shell,
  },
  'hakomi': {
    id: 'hakomi',
    label: 'Hakomi',
    description: 'Hakomi ist eine achtsamkeitsbasierte Psychotherapie, die unbewusste Überzeugungen und Schutzmuster über den Körper zugänglich macht. Im therapeutischen Gespräch entstehen neue Erfahrungen, die tief verankerte Muster verändern können — ohne Konfrontation oder Druck.',
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100',
    Icon: Wind,
  },
  'core-energetics': {
    id: 'core-energetics',
    label: 'Core Energetics',
    description: 'Core Energetics ist eine tiefenpsychologisch fundierte Körperpsychotherapie. Sie verbindet die Arbeit mit Emotionen, Körperhaltung und Atem, um verdrängte Gefühle bewusst zu machen und zu integrieren. Der Ansatz eignet sich besonders für Menschen, die emotionale Blockaden oder chronische Anspannung lösen möchten.',
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
