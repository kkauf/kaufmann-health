/**
 * VerificationForm - Shared UI component for email/SMS verification
 * 
 * Single source of truth for verification UI across the app.
 * Works with useVerification hook for state management.
 * 
 * Supports:
 * - 'input' step: Name + contact method (email/phone) entry
 * - 'code' step: SMS code entry
 * - 'link' step: Email magic link waiting screen
 * - 'verified' step: Success state
 */

'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Phone, Loader2, MailCheck, RefreshCw, CheckCircle2 } from 'lucide-react';
import { VerifiedPhoneInput } from '@/components/VerifiedPhoneInput';
import type { UseVerificationReturn } from '@/lib/verification/useVerification';

export interface VerificationFormProps {
  /** Verification hook return value */
  verification: UseVerificationReturn;
  /** Optional slot summary to display (e.g., selected appointment) */
  slotSummary?: React.ReactNode;
  /** Called when user wants to go back (e.g., to slot selection) */
  onBack?: () => void;
  /** Back button label */
  backLabel?: string;
  /** Whether to show contact method toggle (email/SMS) */
  showContactMethodToggle?: boolean;
  /** Custom class for the container */
  className?: string;
  /** Optional notes for therapist (Cal.com booking) */
  notes?: string;
  /** Callback to update notes */
  onNotesChange?: (notes: string) => void;
  /** Label for notes field (e.g., therapist first name) */
  notesLabel?: string;
  /** Whether phone-first mode is active (name collected after verification) */
  phoneFirst?: boolean;
  /** Options to pass when sending code */
  sendCodeOptions?: {
    redirect?: string;
    formSessionId?: string;
    leadId?: string;
    draftContact?: {
      therapist_id: string;
      contact_type: 'booking' | 'consultation';
      patient_reason?: string;
      patient_message?: string;
      session_format?: 'online' | 'in_person';
    };
    draftBooking?: {
      therapist_id: string;
      date_iso?: string;
      time_label?: string;
      format?: 'online' | 'in_person';
    };
    campaignSource?: string;
    campaignVariant?: string;
    gclid?: string;
  };
}

export function VerificationForm({
  verification,
  slotSummary,
  onBack,
  backLabel = 'Zurück',
  showContactMethodToggle = true,
  className = '',
  notes,
  onNotesChange,
  notesLabel,
  phoneFirst = false,
  sendCodeOptions = {},
}: VerificationFormProps) {
  const { state, setName, setEmail, setPhone, setCode, setContactMethod, sendCode, verifyCode, resendCode } = verification;
  const { step, contactMethod, name, email, phone, code, loading, error } = state;

  const handleSendCode = async () => {
    await sendCode({ name: name.trim(), ...sendCodeOptions });
  };

  const handleResendCode = async () => {
    await resendCode(sendCodeOptions);
  };

  const canSubmitInput = phoneFirst
    ? name.trim().length > 0 && phone.trim().length > 0
    : name.trim() && (
        (contactMethod === 'email' && email.trim()) ||
        (contactMethod === 'phone' && phone.trim())
      );

  // Input step: Collect name + contact info
  if (step === 'input') {
    // Phone-first mode: phone only, no name, no contact method toggle
    if (phoneFirst) {
      return (
        <div className={`space-y-4 ${className}`}>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Handynummer bestätigen</h4>
            <p className="text-xs text-gray-600">
              Deine Nummer wird nur zur Verifizierung verwendet.
            </p>
          </div>

          {slotSummary}

          <div>
            <Label htmlFor="verification-name" className="text-sm font-medium text-gray-700">Name *</Label>
            <Input
              id="verification-name"
              type="text"
              placeholder="Dein Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="verification-contact" className="text-sm font-medium text-gray-700">Handynummer</Label>
            <VerifiedPhoneInput
              value={phone}
              onChange={setPhone}
            />
          </div>

          {/* Optional notes for therapist */}
          {onNotesChange && (
            <div>
              <Label htmlFor="verification-notes" className="text-sm font-medium text-gray-700">
                Notiz{notesLabel ? ` für ${notesLabel}` : ''} (optional)
              </Label>
              <Textarea
                id="verification-notes"
                value={notes || ''}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="z.B. Ich interessiere mich besonders für Somatic Experiencing..."
                maxLength={500}
                rows={2}
                className="mt-1 resize-none text-sm"
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {(notes || '').length}/500
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            {onBack && (
              <Button variant="outline" onClick={onBack} className="flex-1" size="sm">
                {backLabel}
              </Button>
            )}
            <Button
              onClick={handleSendCode}
              disabled={loading || !canSubmitInput}
              className={`${onBack ? 'flex-1' : 'w-full'} bg-emerald-600 hover:bg-emerald-700`}
              size="sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Code senden'}
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setContactMethod('email')}
            className="text-xs text-gray-500 hover:text-gray-700 hover:underline w-full text-center transition-colors"
          >
            Lieber per E-Mail?
          </button>
        </div>
      );
    }

    // Standard mode: full name + contact method
    return (
      <div className={`space-y-4 ${className}`}>
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-1">Deine Kontaktdaten</h4>
          <p className="text-xs text-gray-600">
            Zur Bestätigung deiner Buchung
          </p>
        </div>

        {slotSummary}

        <div>
          <Label htmlFor="verification-name" className="text-sm font-medium text-gray-700">Name *</Label>
          <Input
            id="verification-name"
            type="text"
            placeholder="Dein Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
            required
          />
        </div>

        {showContactMethodToggle && (
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Kontaktmethode</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={contactMethod === 'email' ? 'default' : 'outline'}
                onClick={() => setContactMethod('email')}
                className="flex-1 h-9"
                size="sm"
              >
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                E-Mail
              </Button>
              <Button
                type="button"
                variant={contactMethod === 'phone' ? 'default' : 'outline'}
                onClick={() => setContactMethod('phone')}
                className="flex-1 h-9"
                size="sm"
              >
                <Phone className="h-3.5 w-3.5 mr-1.5" />
                SMS
              </Button>
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="verification-contact" className="text-sm font-medium text-gray-700">
            {contactMethod === 'email' ? 'E-Mail-Adresse' : 'Handynummer'}
          </Label>
          {contactMethod === 'email' ? (
            <Input
              id="verification-contact"
              type="email"
              placeholder="max@beispiel.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          ) : (
            <VerifiedPhoneInput
              value={phone}
              onChange={setPhone}
            />
          )}
        </div>

        {/* Optional notes for therapist */}
        {onNotesChange && (
          <div>
            <Label htmlFor="verification-notes" className="text-sm font-medium text-gray-700">
              Notiz{notesLabel ? ` für ${notesLabel}` : ''} (optional)
            </Label>
            <Textarea
              id="verification-notes"
              value={notes || ''}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="z.B. Ich interessiere mich besonders für Somatic Experiencing..."
              maxLength={500}
              rows={2}
              className="mt-1 resize-none text-sm"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">
              {(notes || '').length}/500
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!canSubmitInput && !error && (
          <p className="text-sm text-amber-600">Bitte fülle alle Pflichtfelder aus.</p>
        )}

        <div className="flex gap-2 pt-1">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="flex-1" size="sm">
              {backLabel}
            </Button>
          )}
          <Button
            onClick={handleSendCode}
            disabled={loading || !canSubmitInput}
            className={`${onBack ? 'flex-1' : 'w-full'} bg-emerald-600 hover:bg-emerald-700`}
            size="sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Bestätigen'}
          </Button>
        </div>
      </div>
    );
  }

  // Code step: SMS code entry
  if (step === 'code') {
    const contactDisplay = contactMethod === 'email' ? email : phone;
    return (
      <div className={`space-y-4 ${className}`}>
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-1">Code eingeben</h4>
          <p className="text-xs text-gray-600">
            Wir haben einen Code an {contactDisplay} gesendet.
          </p>
        </div>

        <div>
          <Label htmlFor="verification-code" className="text-sm font-medium text-gray-700">Bestätigungscode</Label>
          <Input
            id="verification-code"
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1 text-center text-lg tracking-widest"
            maxLength={6}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          {onBack && (
            <Button
              variant="outline"
              onClick={() => {
                setCode('');
                onBack();
              }}
              className="flex-1"
              size="sm"
            >
              {backLabel}
            </Button>
          )}
          <Button
            onClick={() => verifyCode()}
            disabled={loading || !code.trim()}
            className={`${onBack ? 'flex-1' : 'w-full'} bg-emerald-600 hover:bg-emerald-700`}
            size="sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Bestätigen'}
          </Button>
        </div>
      </div>
    );
  }

  // Link step: Email magic link waiting
  if (step === 'link') {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-center py-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
            <MailCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <h4 className="text-base font-semibold text-gray-900 mb-1">E-Mail gesendet!</h4>
          <p className="text-sm text-gray-600">
            Wir haben einen Bestätigungslink an <span className="font-medium">{email}</span> gesendet.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Klicke auf den Link in der E-Mail, um deine Buchung abzuschließen.
          </p>
        </div>

        {slotSummary}

        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
          <p className="font-medium text-gray-700 mb-1">Keine E-Mail erhalten?</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Überprüfe deinen Spam-Ordner</li>
            <li>Stelle sicher, dass die E-Mail-Adresse korrekt ist</li>
          </ul>
        </div>

        <div className="flex gap-2 pt-1">
          {onBack && (
            <Button
              variant="outline"
              onClick={onBack}
              className="flex-1"
              size="sm"
            >
              {backLabel}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleResendCode}
            disabled={loading}
            className="flex-1"
            size="sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Erneut senden
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Verified step: Success
  if (step === 'verified') {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-center py-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <h4 className="text-base font-semibold text-gray-900 mb-1">Verifiziert!</h4>
          <p className="text-sm text-gray-600">
            Deine Kontaktdaten wurden bestätigt.
          </p>
        </div>
      </div>
    );
  }

  // Error or unknown step
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="text-center py-4">
        <p className="text-sm text-red-600">{error || 'Ein unbekannter Fehler ist aufgetreten.'}</p>
        {onBack && (
          <Button variant="outline" onClick={onBack} className="mt-4" size="sm">
            {backLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export default VerificationForm;
