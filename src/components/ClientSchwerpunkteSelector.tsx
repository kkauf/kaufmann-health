'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heart, Activity, UsersRound, Compass, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  META_CATEGORIES,
  getCategoriesByMeta,
  getSchwerpunktById,
  CLIENT_SCHWERPUNKTE_MAX,
  type MetaCategory,
} from '@/lib/schwerpunkte';

const ICON_MAP = {
  Heart,
  Activity,
  UsersRound,
  Compass,
} as const;

// Tooltip auto-dismiss duration in ms
const TOOLTIP_DURATION = 3000;

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
  
  // Track which tooltip is visible (category id) - for click/tap
  const [clickedTooltip, setClickedTooltip] = useState<string | null>(null);
  // Track hover state separately for desktop
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  // Track when user attempts to add beyond max
  const [showMaxWarning, setShowMaxWarning] = useState(false);
  const tooltipTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxWarningTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Auto-dismiss clicked tooltip after duration (but not if hovering)
  useEffect(() => {
    if (clickedTooltip && clickedTooltip !== hoveredCategory) {
      tooltipTimerRef.current = setTimeout(() => {
        setClickedTooltip(null);
      }, TOOLTIP_DURATION);
    }
    return () => {
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
      }
      if (maxWarningTimerRef.current) {
        clearTimeout(maxWarningTimerRef.current);
      }
    };
  }, [clickedTooltip, hoveredCategory]);

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
        setClickedTooltip(null); // Hide tooltip on deselection
        setShowMaxWarning(false); // Clear warning when removing
      } else if (selected.length < maxSelections) {
        onChange([...selected, categoryId]);
        setClickedTooltip(categoryId); // Show tooltip on selection
        setShowMaxWarning(false); // Clear warning on successful add
      } else {
        // User tried to add beyond max - show warning
        setShowMaxWarning(true);
        // Auto-dismiss warning after 3 seconds
        if (maxWarningTimerRef.current) {
          clearTimeout(maxWarningTimerRef.current);
        }
        maxWarningTimerRef.current = setTimeout(() => {
          setShowMaxWarning(false);
        }, TOOLTIP_DURATION);
      }
    },
    [selected, onChange, maxSelections]
  );
  
  // Hover handlers for desktop
  const handleMouseEnter = useCallback((categoryId: string) => {
    setHoveredCategory(categoryId);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setHoveredCategory(null);
  }, []);

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
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />
        ))}
      </div>

      {/* Max selection warning - only shown when user tries to add a 4th topic */}
      {showMaxWarning && (
        <p className="text-center text-sm text-amber-600 font-medium py-2 animate-in fade-in duration-200">
          Maximum erreicht – tippe auf ein Thema, um es zu entfernen
        </p>
      )}

      {/* Snackbar tooltip - shows keywords for hovered/clicked category */}
      {(() => {
        const activeId = hoveredCategory || clickedTooltip;
        const category = activeId ? getSchwerpunktById(activeId) : null;
        if (!category || !category.keywords.length) return null;
        
        return (
          <div 
            className={cn(
              'fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md',
              'bg-gray-900 text-white text-sm rounded-xl px-4 py-3',
              'shadow-2xl',
              'animate-in fade-in slide-in-from-bottom-4 duration-200',
              'pointer-events-none'
            )}
          >
            <p className="font-medium text-gray-300 text-xs mb-1">{category.label}</p>
            <p className="leading-relaxed text-gray-100">
              {category.keywords.join(' · ')}
            </p>
          </div>
        );
      })()}
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
  onMouseEnter: (id: string) => void;
  onMouseLeave: () => void;
}

function AccordionGroup({
  meta,
  isExpanded,
  onToggle,
  selected,
  onSelectCategory,
  atMax,
  onMouseEnter,
  onMouseLeave,
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
          <div className="p-3 pt-1 pb-4 flex flex-wrap gap-2 bg-white">
            {categories.map((category) => {
              const isSelected = selected.includes(category.id);
              const isDisabled = atMax && !isSelected;

              return (
                <div 
                  key={category.id}
                  onMouseEnter={() => onMouseEnter(category.id)}
                  onMouseLeave={onMouseLeave}
                >
                  <button
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
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
