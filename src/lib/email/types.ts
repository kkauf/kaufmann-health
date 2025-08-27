export type LeadType = 'patient' | 'therapist';

export type SendEmailParams = {
  to?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

export type EmailContent = {
  subject: string;
  html?: string;
  text?: string;
};
