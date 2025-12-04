'use client';

import { useState, useCallback } from 'react';
import { Heart, Activity, UsersRound, Compass, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  META_CATEGORIES,
  getCategoriesByMeta,
  CLIENT_SCHWERPUNKTE_MAX,
  type MetaCategory,
} from '@/lib/schwerpunkte';

const ICON_MAP = {
  Heart,
  Activity,
  UsersRound,
  Compass,
} as const;

interface ClientSchwerpunkteSelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  maxSelections?: number;
}

export function ClientSchwerpunkteSelector({
  selected,
  onChange,
  maxSelections = CLIENT_SCHWERPUNKTE_MAX,
}: ClientSchwerpunkteSelectorProps) {
  // First group expanded by default
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set([META_CATEGORIES[0].id])
  );

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const toggleCategory = useCallback(
    (categoryId: string) => {
      const isSelected = selected.includes(categoryId);
      if (isSelected) {
        onChange(selected.filter((id) => id !== categoryId));
      } else if (selected.length < maxSelections) {
        onChange([...selected, categoryId]);
      }
    },
    [selected, onChange, maxSelections]
  );

  const atMax = selected.length >= maxSelections;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="text-center space-y-2 pb-2">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          Was beschäftigt dich?
        </h2>
        <p className="text-base text-gray-600">
          Wähle bis zu {maxSelections} Themen, die dich gerade am meisten betreffen
        </p>
      </div>

      {/* Selection counter */}
      <div className="flex items-center justify-center gap-2 py-2">
        <div className="flex gap-1">
          {Array.from({ length: maxSelections }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-all duration-200',
                i < selected.length
                  ? 'bg-emerald-500 scale-110'
                  : 'bg-gray-200'
              )}
            />
          ))}
        </div>
        <span className="text-sm font-medium text-gray-600">
          {selected.length}/{maxSelections} ausgewählt
        </span>
      </div>

      {/* Accordion groups */}
      <div className="space-y-2">
        {META_CATEGORIES.map((meta) => (
          <AccordionGroup
            key={meta.id}
            meta={meta}
            isExpanded={expandedGroups.has(meta.id)}
            onToggle={() => toggleGroup(meta.id)}
            selected={selected}
            onSelectCategory={toggleCategory}
            atMax={atMax}
          />
        ))}
      </div>

      {/* Max selection hint */}
      {atMax && (
        <p className="text-center text-sm text-amber-600 font-medium py-2">
          Maximum erreicht – tippe auf ein Thema, um es zu entfernen
        </p>
      )}
    </div>
  );
}

interface AccordionGroupProps {
  meta: MetaCategory;
  isExpanded: boolean;
  onToggle: () => void;
  selected: string[];
  onSelectCategory: (id: string) => void;
  atMax: boolean;
}

function AccordionGroup({
  meta,
  isExpanded,
  onToggle,
  selected,
  onSelectCategory,
  atMax,
}: AccordionGroupProps) {
  const Icon = ICON_MAP[meta.icon];
  const categories = getCategoriesByMeta(meta.id);
  const selectedInGroup = categories.filter((c) => selected.includes(c.id)).length;

  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden transition-all duration-200',
        meta.color.border,
        isExpanded ? 'shadow-md' : 'shadow-sm'
      )}
    >
      {/* Group header - 56px touch target */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 p-4 min-h-[56px] text-left transition-colors',
          meta.color.bg,
          'hover:brightness-95 active:brightness-90'
        )}
        aria-expanded={isExpanded}
      >
        {/* Icon bubble */}
        <div
          className={cn(
            'flex-shrink-0 rounded-xl p-2.5 shadow-sm',
            meta.color.iconBg,
            meta.color.text
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Label and count */}
        <div className="flex-1 min-w-0">
          <span className={cn('font-semibold text-base', meta.color.text)}>
            {meta.label}
          </span>
          {selectedInGroup > 0 && (
            <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500 text-white text-xs font-bold">
              {selectedInGroup}
            </span>
          )}
        </div>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            'h-5 w-5 flex-shrink-0 transition-transform duration-200',
            meta.color.text,
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Expandable content */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300',
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className="p-3 pt-0 flex flex-wrap gap-2">
            {categories.map((category) => {
              const isSelected = selected.includes(category.id);
              const isDisabled = atMax && !isSelected;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onSelectCategory(category.id)}
                  disabled={isDisabled}
                  className={cn(
                    // Base - 44px min touch target
                    'inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px]',
                    'rounded-full text-sm font-medium',
                    'border transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                    // States
                    isSelected
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                      : isDisabled
                        ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                        : cn(
                            'bg-white border-gray-200 text-gray-700',
                            'hover:border-emerald-300 hover:bg-emerald-50 active:bg-emerald-100'
                          )
                  )}
                >
                  {isSelected && <Check className="h-4 w-4" />}
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
