/**
 * Notification Email Recipients
 *
 * Centralized configuration for internal notification email routing.
 * Each notification type has a dedicated email address with fallback to LEADS_NOTIFY_EMAIL.
 *
 * Environment variables:
 * - LEADS_NOTIFY_EMAIL: New patient leads (primary fallback for all types)
 * - PARTNERS_NOTIFY_EMAIL: New therapist sign-ups (partner team)
 * - ADMIN_NOTIFY_EMAIL: Technical alerts, system errors, critical alerts
 * - QA_NOTIFY_EMAIL: Test mode email reroutes (QA testing)
 */

/**
 * Email for new patient lead notifications.
 * Used for: lead submission alerts, leads requiring manual matching
 */
export function getLeadsNotifyEmail(): string {
  return (process.env.LEADS_NOTIFY_EMAIL || '').trim();
}

/**
 * Email for new therapist sign-up notifications.
 * Used for: therapist registration alerts, partner team notifications
 * Fallback: LEADS_NOTIFY_EMAIL
 */
export function getPartnersNotifyEmail(): string {
  const partners = (process.env.PARTNERS_NOTIFY_EMAIL || '').trim();
  if (partners) return partners;
  return getLeadsNotifyEmail();
}

/**
 * Email for technical/admin alerts.
 * Used for: system errors, critical alerts, email bounces, webhook failures
 * Fallback: LEADS_NOTIFY_EMAIL
 */
export function getAdminNotifyEmail(): string {
  const admin = (process.env.ADMIN_NOTIFY_EMAIL || '').trim();
  if (admin) return admin;
  return getLeadsNotifyEmail();
}

/**
 * Email for QA/test mode reroutes.
 * Used for: test mode booking emails, preview emails
 * Fallback: LEADS_NOTIFY_EMAIL
 */
export function getQaNotifyEmail(): string {
  const qa = (process.env.QA_NOTIFY_EMAIL || '').trim();
  if (qa) return qa;
  return getLeadsNotifyEmail();
}

/**
 * Default notification email (legacy compatibility).
 * New code should use the specific getters above.
 */
export function getNotifyEmail(): string {
  return getLeadsNotifyEmail();
}
