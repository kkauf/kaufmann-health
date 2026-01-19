'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

// Languages stored and displayed in their native form
const COMMON_LANGUAGES = [
  'Deutsch', 'English', 'Français', 'Español', 'Italiano',
  'Português', 'Nederlands', 'Polski', 'Русский', 'Українська',
  'Türkçe', 'العربية', 'فارسی', 'हिन्दी', 'اردو',
  '中文', '日本語', '한국어', 'Tiếng Việt', 'ไทย',
  'Ελληνικά', 'Română', 'Български', 'Српски', 'Hrvatski',
  'Bosanski', 'Slovenščina', 'Slovenčina', 'Čeština', 'Magyar',
  'Suomi', 'Svenska', 'Norsk', 'Dansk', 'Íslenska',
  'עברית', 'Kurdî', 'Shqip', 'Македонски', 'Lietuvių',
  'Latviešu', 'Eesti', 'ქართული', 'Armenian', 'বাংলা',
  'தமிழ்', 'తెలుగు', 'मराठी', 'ગુજરાતી', 'ਪੰਜਾਬੀ',
  'Bahasa Indonesia', 'Bahasa Melayu', 'Tagalog', 'Kiswahili', 'Afrikaans',
];

// German-language aliases for common languages (maps German name -> native name)
const LANGUAGE_ALIASES: Record<string, string> = {
  'türkisch': 'Türkçe',
  'arabisch': 'العربية',
  'persisch': 'فارسی',
  'russisch': 'Русский',
  'ukrainisch': 'Українська',
  'polnisch': 'Polski',
  'griechisch': 'Ελληνικά',
  'chinesisch': '中文',
  'japanisch': '日本語',
  'koreanisch': '한국어',
  'hebräisch': 'עברית',
  'kurdisch': 'Kurdî',
  'englisch': 'English',
  'französisch': 'Français',
  'spanisch': 'Español',
  'italienisch': 'Italiano',
  'portugiesisch': 'Português',
};

interface LanguageInputProps {
  value: string[];
  onChange: (languages: string[]) => void;
  placeholder?: string;
}

export function LanguageInput({ value, onChange, placeholder = 'Sprache eingeben...' }: LanguageInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input, excluding already selected
  // Also check German aliases (e.g. "Türkisch" matches "Türkçe")
  const suggestions = inputValue.trim()
    ? COMMON_LANGUAGES.filter((lang) => {
        if (value.includes(lang)) return false;
        // Direct match on native name
        if (lang.toLowerCase().includes(inputValue.toLowerCase())) return true;
        // Check if input matches a German alias for this language
        const aliasMatch = Object.entries(LANGUAGE_ALIASES).find(
          ([alias, native]) => native === lang && alias.includes(inputValue.toLowerCase())
        );
        return !!aliasMatch;
      }).slice(0, 8)
    : [];

  // Check if input matches any suggestion exactly (case-insensitive), including aliases
  const exactMatch = COMMON_LANGUAGES.find(
    (lang) => lang.toLowerCase() === inputValue.toLowerCase()
  ) || (LANGUAGE_ALIASES[inputValue.toLowerCase()] && 
        !value.includes(LANGUAGE_ALIASES[inputValue.toLowerCase()]) 
          ? LANGUAGE_ALIASES[inputValue.toLowerCase()] 
          : undefined);

  // Can add custom if not empty, not already selected, and not an exact match suggestion
  const canAddCustom =
    inputValue.trim() &&
    !value.some((v) => v.toLowerCase() === inputValue.trim().toLowerCase()) &&
    !exactMatch;

  const addLanguage = (lang: string) => {
    const trimmed = lang.trim();
    // Prevent entries with separators - user should add languages one by one
    if (trimmed.includes('/') || trimmed.includes(',') || trimmed.toLowerCase().includes(' und ') || trimmed.toLowerCase().includes(' and ')) {
      // Split and add each part separately
      const parts = trimmed.split(/[\/,]|\s+und\s+|\s+and\s+/i).map(p => p.trim()).filter(Boolean);
      const newLangs = parts.filter(p => !value.some(v => v.toLowerCase() === p.toLowerCase()));
      if (newLangs.length > 0) {
        onChange([...value, ...newLangs]);
      }
    } else if (trimmed && !value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
    setShowSuggestions(false);
    setHighlightedIndex(0);
    inputRef.current?.focus();
  };

  const removeLanguage = (lang: string) => {
    onChange(value.filter((v) => v !== lang));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0 && highlightedIndex < suggestions.length) {
        addLanguage(suggestions[highlightedIndex]);
      } else if (canAddCustom) {
        addLanguage(inputValue.trim());
      } else if (exactMatch && !value.includes(exactMatch)) {
        addLanguage(exactMatch);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        Math.min(prev + 1, suggestions.length - 1 + (canAddCustom ? 1 : 0))
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeLanguage(value[value.length - 1]);
    }
  };

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [inputValue]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg bg-white min-h-[42px] focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-400 transition-all">
        {/* Selected languages as pills */}
        {value.map((lang) => (
          <span
            key={lang}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-violet-50 text-violet-700 border border-violet-200"
          >
            {lang}
            <button
              type="button"
              onClick={() => removeLanguage(lang)}
              className="hover:bg-violet-200 rounded-full p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (suggestions.length > 0 || canAddCustom) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((lang, index) => (
            <button
              key={lang}
              type="button"
              onClick={() => addLanguage(lang)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                index === highlightedIndex
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'hover:bg-gray-50'
              }`}
            >
              {lang}
            </button>
          ))}
          {canAddCustom && (
            <button
              type="button"
              onClick={() => addLanguage(inputValue.trim())}
              className={`w-full text-left px-3 py-2 text-sm border-t border-gray-100 transition-colors ${
                highlightedIndex === suggestions.length
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'hover:bg-gray-50 text-gray-600'
              }`}
            >
              <span className="font-medium">&quot;{inputValue.trim()}&quot;</span> hinzufügen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
