/**
 * Reusable PhoneInput component with consistent configuration
 * Handles international phone numbers with E.164 normalization
 */

'use client';

import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import '@/components/phone-input-custom.css';

interface VerifiedPhoneInputProps {
  value: string;
  onChange: (phone: string) => void;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoComplete?: string;
  id?: string;
  helpText?: string;
}

/**
 * PhoneInput component configured for international E.164 phone numbers
 * - Allows typing '+' for international numbers
 * - Removes spaces automatically for consistent storage
 * - Defaults to Germany (DE) but supports all countries
 */
export function VerifiedPhoneInput({
  value,
  onChange,
  disabled = false,
  error,
  placeholder = '+49 176 123 45678',
  className = 'w-full',
  inputClassName,
  autoComplete = 'tel',
  id = 'phone',
  helpText,
}: VerifiedPhoneInputProps) {
  return (
    <div className="space-y-2">
      <PhoneInput
        defaultCountry="de"
        value={value}
        onChange={(phone) => onChange(phone.replace(/\s+/g, ''))}
        disabled={disabled}
        inputClassName={error ? 'border-red-500' : inputClassName}
        className={className}
        placeholder={placeholder}
        inputProps={{
          name: 'phone_number',
          autoComplete,
          inputMode: 'tel' as const,
          id,
        }}
        countrySelectorStyleProps={{
          buttonClassName: 'phone-country-button',
          dropdownStyleProps: {
            className: 'phone-country-dropdown',
            listItemClassName: 'phone-country-item',
          },
        }}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {helpText && !error && <p className="text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}
