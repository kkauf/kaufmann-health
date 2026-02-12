"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type Screen1_5Values = {
  phone_verification_code?: string;
  phone_verified?: boolean;
};

/**
 * Screen1.5 - Verification Code Entry
 * Supports both SMS and email 6-digit code verification.
 * For email, the code is sent alongside a magic link (fallback).
 */
export default function Screen1_5({
  phoneNumber,
  contactMethod = 'phone',
  contactDisplay,
  onVerify,
  onResend,
  onBack,
  disabled,
}: {
  phoneNumber: string;
  /** Which channel the code was sent to */
  contactMethod?: 'phone' | 'email';
  /** Formatted contact info for display (email address or formatted phone). Falls back to phoneNumber for SMS. */
  contactDisplay?: string;
  onVerify: (code: string) => Promise<{ success: boolean; error?: string }>;
  onResend: () => Promise<void>;
  onBack?: () => void;
  disabled?: boolean;
}) {
  const [code, setCode] = React.useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resending, setResending] = React.useState(false);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = React.useCallback((index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(null);

    // Auto-advance to next field
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newCode.every(d => d) && value) {
      handleVerify(newCode.join(''));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- handleVerify is defined below
  }, [code]);

  const handleKeyDown = React.useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [code]);

  const handlePaste = React.useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      setError(null);
      inputRefs.current[5]?.focus();
      
      // Auto-submit
      handleVerify(pastedData);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- handleVerify is defined below
  }, []);

  const handleVerify = React.useCallback(async (codeString: string) => {
    if (verifying) return;
    
    setVerifying(true);
    setError(null);

    try {
      const result = await onVerify(codeString);
      
      if (!result.success) {
        setError(result.error || 'Ungültiger Code');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Fehler bei der Überprüfung');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  }, [verifying, onVerify]);

  const handleResend = React.useCallback(async () => {
    if (resending) return;
    
    setResending(true);
    setError(null);
    setCode(['', '', '', '', '', '']);
    
    try {
      await onResend();
      inputRefs.current[0]?.focus();
    } catch {
      setError('Fehler beim erneuten Senden');
    } finally {
      setResending(false);
    }
  }, [resending, onResend]);

  // Format phone for display (only if showing phone)
  const displayPhone = phoneNumber.startsWith('+49')
    ? phoneNumber.replace('+49', '0').replace(/(\d{4})(\d{3})(\d)/, '$1 $2 $3')
    : phoneNumber;

  const isEmail = contactMethod === 'email';
  const displayContact = contactDisplay || displayPhone;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold">{isEmail ? 'E-Mail-Code eingeben' : 'SMS-Code eingeben'}</h3>
        <p className="text-sm text-muted-foreground">
          Wir haben dir einen 6-stelligen Code an <strong>{displayContact}</strong> gesendet
        </p>
      </div>

      <div className="space-y-4">
        <Label htmlFor="code-0" className="sr-only">Bestätigungscode</Label>
        <div className="flex gap-2 justify-center">
          {code.map((digit, index) => (
            <Input
              key={index}
              ref={el => { inputRefs.current[index] = el; }}
              id={`code-${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              disabled={disabled || verifying}
              className={`w-12 h-14 text-center text-xl font-semibold ${
                error ? 'border-red-500' : ''
              }`}
              aria-label={`Ziffer ${index + 1}`}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}

        {verifying && (
          <p className="text-sm text-muted-foreground text-center">
            Code wird überprüft...
          </p>
        )}
      </div>

      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Keinen Code erhalten?
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={handleResend}
          disabled={resending || verifying}
          className="w-full"
        >
          {resending ? 'Wird gesendet...' : 'Code erneut senden'}
        </Button>
      </div>

      {onBack && (
        <div className="pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onBack}
            disabled={disabled || verifying || resending}
            className="w-full"
          >
            Zurück
          </Button>
        </div>
      )}
    </div>
  );
}
