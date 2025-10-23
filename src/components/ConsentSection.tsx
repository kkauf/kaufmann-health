"use client";

import React from 'react';

type Actor = 'patient' | 'therapist' | 'directory';

export function ConsentSection({
  actor = 'patient',
  requireCheckbox = false,
  checked,
  onChange,
  className,
  compact = true,
}: {
  actor?: Actor;
  requireCheckbox?: boolean;
  checked?: boolean;
  onChange?: (next: boolean) => void;
  className?: string;
  compact?: boolean;
}) {
  const [localChecked, setLocalChecked] = React.useState(false);
  const isChecked = typeof checked === 'boolean' ? checked : localChecked;

  const handleToggle = (next: boolean) => {
    setLocalChecked(next);
    onChange?.(next);
  };

  const text = (() => {
    if (actor === 'therapist') {
      return (
        <>
          Mit dem Klick auf „Jetzt registrieren“ akzeptierst du unsere{' '}
          <a href="/agb" className="underline">AGB</a>.
        </>
      );
    }
    // patient + directory share same wording
    return (
      <>
        Mit dem Absenden bestätigst du die{' '}
        <a href="/datenschutz" className="underline">Datenschutzerklärung</a>{' '}und die{' '}
        <a href="/agb" className="underline">AGB</a> sowie die Weitergabe deiner Angaben an von dir augewählte Therapeut:innen zur Kontaktaufnahme.
      </>
    );
  })();

  return (
    <div className={className || ''}>
      {requireCheckbox ? (
        <label className={`flex items-start gap-2 ${compact ? 'text-xs' : 'text-sm'} text-gray-600`}>
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300"
            checked={isChecked}
            onChange={(e) => handleToggle(e.target.checked)}
          />
          <span>{text}</span>
        </label>
      ) : (
        <p className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600`}>{text}</p>
      )}
    </div>
  );
}

export default ConsentSection;
