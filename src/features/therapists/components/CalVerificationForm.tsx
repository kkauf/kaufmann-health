/**
 * CalVerificationForm - Inline verification for Cal.com booking (EARTH-256)
 *
 * Compact form for name + email/phone entry and code verification.
 * Used within TherapistDetailModal for unverified directory users.
 */

'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Phone, Loader2 } from 'lucide-react';
import type { CalBookingState, CalBookingActions } from '../hooks/useCalBooking';

interface CalVerificationFormProps {
  state: CalBookingState;
  actions: CalBookingActions;
  slotSummary?: React.ReactNode;
}

export function CalVerificationForm({ state, actions, slotSummary }: CalVerificationFormProps) {
  const { step, name, contactMethod, contactValue, verificationCode, verifyLoading, verifyError } = state;

  if (step === 'verify') {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-1">Deine Kontaktdaten</h4>
          <p className="text-xs text-gray-600">
            Zur Bestätigung deiner Buchung
          </p>
        </div>

        {slotSummary}

        <div>
          <Label htmlFor="cal-name" className="text-sm font-medium text-gray-700">Name</Label>
          <Input
            id="cal-name"
            type="text"
            placeholder="Max Mustermann"
            value={name}
            onChange={(e) => actions.setName(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-sm font-medium text-gray-700 mb-2 block">Kontaktmethode</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={contactMethod === 'email' ? 'default' : 'outline'}
              onClick={() => actions.setContactMethod('email')}
              className="flex-1 h-9"
              size="sm"
            >
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              E-Mail
            </Button>
            <Button
              type="button"
              variant={contactMethod === 'phone' ? 'default' : 'outline'}
              onClick={() => actions.setContactMethod('phone')}
              className="flex-1 h-9"
              size="sm"
            >
              <Phone className="h-3.5 w-3.5 mr-1.5" />
              SMS
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="cal-contact" className="text-sm font-medium text-gray-700">
            {contactMethod === 'email' ? 'E-Mail-Adresse' : 'Handynummer'}
          </Label>
          <Input
            id="cal-contact"
            type={contactMethod === 'email' ? 'email' : 'tel'}
            placeholder={contactMethod === 'email' ? 'max@beispiel.de' : '+49 170 1234567'}
            value={contactValue}
            onChange={(e) => actions.setContactValue(e.target.value)}
            className="mt-1"
          />
        </div>

        {verifyError && <p className="text-sm text-red-600">{verifyError}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={actions.backToSlots} className="flex-1" size="sm">
            Zurück
          </Button>
          <Button
            onClick={actions.sendCode}
            disabled={verifyLoading || !name.trim() || !contactValue.trim()}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            {verifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Code senden'}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-1">Code eingeben</h4>
          <p className="text-xs text-gray-600">
            Wir haben einen Code an {contactValue} gesendet.
          </p>
        </div>

        <div>
          <Label htmlFor="cal-code" className="text-sm font-medium text-gray-700">Bestätigungscode</Label>
          <Input
            id="cal-code"
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={verificationCode}
            onChange={(e) => actions.setVerificationCode(e.target.value)}
            className="mt-1 text-center text-lg tracking-widest"
            maxLength={6}
          />
        </div>

        {verifyError && <p className="text-sm text-red-600">{verifyError}</p>}

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={() => {
              actions.setVerificationCode('');
              actions.backToSlots();
            }}
            className="flex-1"
            size="sm"
          >
            Zurück
          </Button>
          <Button
            onClick={actions.verifyCode}
            disabled={verifyLoading || !verificationCode.trim()}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            {verifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Bestätigen'}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
