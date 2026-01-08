export type LeadType = 'patient' | 'therapist';

export type SendEmailParams = {
  to?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  // Optional custom headers sent via provider payload (e.g., List-Unsubscribe)
  headers?: Record<string, string>;
  // Optional extra properties to include in logging (PII-free), e.g. { correlation_id, lead_id, kind }
  context?: Record<string, unknown>;
};

export type EmailContent = {
  subject: string;
  html?: string;
  text?: string;
};

export type SendEmailResult = {
  sent: boolean;
  /** Why the email was not sent (only set when sent=false) */
  reason?: 'suppressed' | 'missing_api_key' | 'missing_recipient' | 'failed';
};
