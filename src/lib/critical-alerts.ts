/**
 * Critical Alerts - Immediate email notifications for production outages
 * 
 * Use for:
 * - Booking system failures (Cal.com unreachable)
 * - Payment failures
 * - Auth system issues
 * - Database connectivity issues
 * 
 * NOT for:
 * - Normal errors (use logger/events table)
 * - User-caused errors (validation, etc.)
 */

import { sendEmail } from '@/lib/email/client';
import { track } from '@/lib/logger';
import { getAdminNotifyEmail } from '@/lib/email/notification-recipients';

// In-memory rate limiting to avoid spamming (per alert type, 5 min cooldown)
const alertCooldowns = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export type CriticalAlertType =
  | 'booking_system_down'
  | 'cal_cache_stale'
  | 'cal_slots_timeout'
  | 'payment_failure'
  | 'auth_system_error'
  | 'database_error'
  | 'cron_job_failed';

interface CriticalAlertOptions {
  type: CriticalAlertType;
  message: string;
  details?: Record<string, unknown>;
  /** Skip cooldown check (for truly critical one-off alerts) */
  force?: boolean;
}

/**
 * Send an immediate critical alert email
 * 
 * Rate-limited to 1 alert per type per 5 minutes to avoid spam.
 */
export async function sendCriticalAlert(options: CriticalAlertOptions): Promise<boolean> {
  const { type, message, details, force } = options;

  const alertEmail = getAdminNotifyEmail();
  if (!alertEmail) {
    console.error('[critical-alerts] ADMIN_NOTIFY_EMAIL not configured');
    return false;
  }

  // Check cooldown (unless forced)
  if (!force) {
    const lastAlertTime = alertCooldowns.get(type);
    if (lastAlertTime && Date.now() - lastAlertTime < COOLDOWN_MS) {
      console.log(`[critical-alerts] Skipping ${type} - cooldown active`);
      return false;
    }
  }

  // Update cooldown
  alertCooldowns.set(type, Date.now());

  const subject = `🚨 [KH CRITICAL] ${typeToTitle(type)}`;
  const timestamp = new Date().toISOString();
  
  const text = [
    `CRITICAL ALERT: ${typeToTitle(type)}`,
    '',
    `Time: ${timestamp}`,
    `Message: ${message}`,
    '',
    details ? `Details:\n${JSON.stringify(details, null, 2)}` : '',
    '',
    'Next steps:',
    '- Check Vercel Functions logs for the affected route',
    '- Check /admin/errors for recent errors',
    '- If Cal.com related, check Cal.com status and database connectivity',
  ].filter(Boolean).join('\n');

  try {
    await sendEmail({
      to: alertEmail,
      subject,
      text,
      context: {
        kind: 'critical_alert',
        alert_type: type,
        timestamp,
      },
    });

    // Track the alert
    void track({
      type: 'critical_alert_sent',
      level: 'error',
      source: 'lib.critical-alerts',
      props: { alert_type: type, message, ...details },
    });

    console.log(`[critical-alerts] Sent ${type} alert`);
    return true;
  } catch (err) {
    console.error('[critical-alerts] Failed to send alert:', err);
    return false;
  }
}

function typeToTitle(type: CriticalAlertType): string {
  switch (type) {
    case 'booking_system_down':
      return 'Booking System Down';
    case 'cal_cache_stale':
      return 'Cal.com Cache Stale';
    case 'cal_slots_timeout':
      return 'Cal.com Slots Timeout';
    case 'payment_failure':
      return 'Payment System Failure';
    case 'auth_system_error':
      return 'Authentication System Error';
    case 'database_error':
      return 'Database Connectivity Error';
    case 'cron_job_failed':
      return 'Cron Job Failed';
    default:
      return type;
  }
}

/**
 * Fire-and-forget critical alert (for use in catch blocks)
 */
export function fireCriticalAlert(options: CriticalAlertOptions): void {
  void sendCriticalAlert(options).catch(() => {
    // Silently fail - we don't want alert failures to cause more issues
  });
}
