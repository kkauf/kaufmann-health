/**
 * CalVerificationForm - Adapter for Cal.com booking verification (EARTH-256)
 *
 * Wraps the shared VerificationForm component for use with useCalBooking.
 * Maps CalBookingState/Actions to the shared verification interface.
 * 
 * @deprecated Consider using VerificationForm directly with useVerification hook
 */

'use client';

import { useMemo } from 'react';
import { VerificationForm } from '@/components/VerificationForm';
import type { CalBookingState, CalBookingActions } from '../hooks/useCalBooking';
import type { UseVerificationReturn, VerificationStep } from '@/lib/verification/useVerification';

interface CalVerificationFormProps {
  state: CalBookingState;
  actions: CalBookingActions;
  slotSummary?: React.ReactNode;
}

/**
 * Maps Cal booking step to verification step
 */
function mapStep(calStep: CalBookingState['step']): VerificationStep {
  switch (calStep) {
    case 'verify': return 'input';
    case 'code': return 'code';
    case 'email-sent': return 'link';
    default: return 'input';
  }
}

export function CalVerificationForm({ state, actions, slotSummary }: CalVerificationFormProps) {
  // Create adapter that maps CalBooking interface to UseVerificationReturn
  const verificationAdapter: UseVerificationReturn = useMemo(() => ({
    state: {
      step: mapStep(state.step),
      contactMethod: state.contactMethod,
      name: state.name,
      email: state.contactMethod === 'email' ? state.contactValue : '',
      phone: state.contactMethod === 'phone' ? state.contactValue : '',
      code: state.verificationCode,
      loading: state.verifyLoading,
      error: state.verifyError,
      verified: false,
      patientId: null,
    },
    setName: actions.setName,
    setEmail: (email: string) => actions.setContactValue(email),
    setPhone: (phone: string) => actions.setContactValue(phone),
    setCode: actions.setVerificationCode,
    setContactMethod: actions.setContactMethod,
    setError: () => {}, // Not directly exposed in CalBookingActions
    sendCode: async () => {
      await actions.sendCode();
      return { success: true };
    },
    verifyCode: async () => {
      await actions.verifyCode();
      return { success: true };
    },
    resendCode: async () => {
      await actions.sendCode();
      return { success: true };
    },
    reset: () => {}, // Handled by useCalBooking
    validateInputs: () => ({ valid: true }),
    getContact: () => state.contactValue,
    isPhoneValid: () => true,
    isEmailValid: () => true,
  }), [state, actions]);

  return (
    <VerificationForm
      verification={verificationAdapter}
      slotSummary={slotSummary}
      onBack={actions.backToSlots}
      backLabel="Zurück"
      showContactMethodToggle={true}
    />
  );
}
