import type { LeadType, EmailContent } from './types';

export type NotificationRow = {
  id: string;
  metadata?: {
    lead_type?: LeadType;
    city?: string | null;
  } | null;
};

/**
 * Builds a PII-free internal notification for any lead.
 * Subject and first line include lead type and city. Includes lead ID for lookup.
 */
export function buildInternalLeadNotification(row: NotificationRow): EmailContent {
  const type: LeadType = (row.metadata?.lead_type === 'therapist' ? 'therapist' : 'patient');
  const city = (row.metadata?.city || '').trim() || 'unknown';
  const subject = `Lead: ${type} · ${city}`;

  const lines: string[] = [
    `Lead received (${type} · ${city})`,
    `Lead ID: ${row.id}`,
    'Note: PII is available only in Supabase.',
    'Review and match: /admin/leads',
  ];
  if (type === 'therapist') {
    lines.push('Contract signed automatically');
  }

  return {
    subject,
    text: lines.join('\n'),
  };
}
