'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Euro, User, Clock, MapPin, Heart } from 'lucide-react';

export type RejectionReason = 
  | 'price_insurance'
  | 'gender_mismatch'
  | 'availability_issue'
  | 'location_mismatch'
  | 'vibe_method';

interface RejectionOption {
  id: RejectionReason;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const REJECTION_OPTIONS: RejectionOption[] = [
  {
    id: 'price_insurance',
    label: 'Keine Kassenabrechnung / Zu teuer',
    icon: Euro,
  },
  {
    id: 'gender_mismatch',
    label: 'Ich suche ein anderes Geschlecht',
    icon: User,
  },
  {
    id: 'availability_issue',
    label: 'Termine passen mir nicht',
    icon: Clock,
  },
  {
    id: 'location_mismatch',
    label: 'Praxis ist zu weit weg / Nur Online',
    icon: MapPin,
  },
  {
    id: 'vibe_method',
    label: 'Methode/Profil spricht mich nicht an',
    icon: Heart,
  },
];

interface MatchRejectionModalProps {
  open: boolean;
  therapistName: string;
  onSelect: (reason: RejectionReason) => void;
  onClose: () => void;
}

export function MatchRejectionModal({
  open,
  therapistName,
  onSelect,
  onClose,
}: MatchRejectionModalProps) {
  const [selectedReason, setSelectedReason] = useState<RejectionReason | null>(null);

  const handleSubmit = () => {
    if (selectedReason) {
      onSelect(selectedReason);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Hilf uns, den Algorithmus zu verbessern
          </DialogTitle>
          <DialogDescription className="text-base">
            Warum passt {therapistName} nicht?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {REJECTION_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedReason === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedReason(option.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isSelected ? 'text-emerald-600' : 'text-gray-500'}`} />
                <span className="text-sm font-medium">{option.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Abbrechen
          </Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSubmit}
            disabled={!selectedReason}
          >
            Andere Optionen zeigen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
