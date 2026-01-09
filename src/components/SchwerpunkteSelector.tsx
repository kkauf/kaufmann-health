'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { ChevronDown, Check, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  SCHWERPUNKT_CATEGORIES,
  THERAPIST_SCHWERPUNKTE_MAX,
  CLIENT_SCHWERPUNKTE_MAX,
  getSchwerpunktLabel,
  type SchwerpunktCategory,
} from '@/lib/schwerpunkte';
import { cn } from '@/lib/utils';

type Role = 'therapist' | 'client';

type Props = {
  /** Selected category IDs */
  value: string[];
  /** Called when selection changes */
  onChange: (ids: string[]) => void;
  /** Role determines min/max limits and display style */
  role: Role;
  /** Optional error message */
  error?: string;
  /** Disable interaction */
  disabled?: boolean;
};

const WARNING_DURATION = 3000;

export function SchwerpunkteSelector({
  value,
  onChange,
  role,
  error,
  disabled,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showMaxWarning, setShowMaxWarning] = useState(false);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxSelections = role === 'therapist' ? THERAPIST_SCHWERPUNKTE_MAX : CLIENT_SCHWERPUNKTE_MAX;
  
  const selectedSet = useMemo(() => new Set(value), [value]);
  const atMax = value.length >= maxSelections;

  const toggleCategory = useCallback(
    (categoryId: string) => {
      if (disabled) return;
      
      if (selectedSet.has(categoryId)) {
        // Remove
        onChange(value.filter((id) => id !== categoryId));
        setShowMaxWarning(false);
      } else if (!atMax) {
        // Add if under limit
        onChange([...value, categoryId]);
        setShowMaxWarning(false);
      } else {
        // User tried to add beyond max - show warning
        setShowMaxWarning(true);
        if (warningTimerRef.current) {
          clearTimeout(warningTimerRef.current);
        }
        warningTimerRef.current = setTimeout(() => {
          setShowMaxWarning(false);
        }, WARNING_DURATION);
      }
    },
    [value, onChange, selectedSet, atMax, disabled]
  );

  const toggleExpand = useCallback((categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId((prev) => (prev === categoryId ? null : categoryId));
  }, []);

  return (
    <div className="space-y-3">
      {/* Selection counter */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {value.length} / {maxSelections} ausgewählt
        </span>
        {showMaxWarning && (
          <span className="text-amber-600 font-medium flex items-center gap-1 animate-in fade-in duration-200">
            <AlertCircle className="h-3.5 w-3.5" />
            Maximum erreicht – tippe auf ein Thema, um es zu entfernen
          </span>
        )}
      </div>

      {/* Category list */}
      <div className="space-y-2">
        {SCHWERPUNKT_CATEGORIES.map((cat) => (
          <CategoryItem
            key={cat.id}
            category={cat}
            isSelected={selectedSet.has(cat.id)}
            isExpanded={expandedId === cat.id}
            onToggleSelect={() => toggleCategory(cat.id)}
            onToggleExpand={(e) => toggleExpand(cat.id, e)}
            disabled={disabled || (atMax && !selectedSet.has(cat.id))}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1.5 mt-2" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Selected tags summary */}
      {value.length > 0 && (
        <div className="pt-3 border-t">
          <p className="text-xs text-gray-500 mb-2">Deine Auswahl:</p>
          <div className="flex flex-wrap gap-2">
            {value.map((id) => (
              <Badge
                key={id}
                variant="secondary"
                className="gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                onClick={() => !disabled && toggleCategory(id)}
              >
                {getSchwerpunktLabel(id)}
                <span className="text-emerald-500">×</span>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type CategoryItemProps = {
  category: SchwerpunktCategory;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: (e: React.MouseEvent) => void;
  disabled: boolean;
};

function CategoryItem({
  category,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  disabled,
}: CategoryItemProps) {
  return (
    <div
      className={cn(
        'rounded-lg border transition-all',
        isSelected
          ? 'border-emerald-300 bg-emerald-50/50 shadow-sm'
          : disabled
          ? 'border-gray-200 bg-gray-50 opacity-60'
          : 'border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30'
      )}
    >
      {/* Category header */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={onToggleSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleSelect();
          }
        }}
        className={cn(
          'flex items-center gap-3 px-4 py-3 cursor-pointer',
          disabled && 'cursor-not-allowed'
        )}
      >
        {/* Checkbox indicator */}
        <div
          className={cn(
            'h-5 w-5 rounded border-2 flex items-center justify-center transition-colors shrink-0',
            isSelected
              ? 'border-emerald-500 bg-emerald-500'
              : 'border-gray-300 bg-white'
          )}
        >
          {isSelected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
        </div>

        {/* Label */}
        <span
          className={cn(
            'flex-1 font-medium text-sm',
            isSelected ? 'text-emerald-900' : 'text-gray-700'
          )}
        >
          {category.label}
        </span>

        {/* Expand button */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          aria-label={isExpanded ? 'Details verbergen' : 'Details anzeigen'}
          aria-expanded={isExpanded}
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        </button>
      </div>

      {/* Expanded keywords */}
      {isExpanded && (
        <div className="px-4 pb-3">
          <div className="pl-8 text-sm text-gray-600 space-y-1">
            <p className="text-xs text-gray-500 mb-1.5">Typische Themen:</p>
            <div className="flex flex-wrap gap-1.5">
              {category.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SchwerpunkteSelector;
