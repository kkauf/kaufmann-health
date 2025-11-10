import { request, APIRequestContext, expect } from '@playwright/test';

const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

export type AdminSession = {
  ctx: APIRequestContext;
  adminCookie: string; // raw cookie value for kh_admin
};

export async function adminLogin(): Promise<AdminSession> {
  const password = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
  if (!password) throw new Error('Set E2E_ADMIN_PASSWORD or ADMIN_PASSWORD for E2E admin login');
  const ctx = await request.newContext({ baseURL: base });
  const res = await ctx.post('/api/admin/login', { data: { password }, ignoreHTTPSErrors: true });
  expect(res.status()).toBe(200);
  const setCookie = res.headers()['set-cookie'] || res.headers()['Set-Cookie'] || '';
  const match = /kh_admin=([^;]+)/.exec(setCookie);
  if (!match) throw new Error('Admin cookie not set');
  const adminCookie = decodeURIComponent(match[1]);
  return { ctx, adminCookie };
}

export async function resetTherapistSlots(session: AdminSession, therapistId: string) {
  const existing = await listSlots(session, therapistId);
  for (const s of existing) {
    await deleteSlot(session, therapistId, s.id);
  }
}

export function adminHeaders(session: AdminSession): Record<string, string> {
  return { cookie: `kh_admin=${encodeURIComponent(session.adminCookie)}` };
}

export async function setPracticeAddress(session: AdminSession, therapistId: string, address: string) {
  const res = await session.ctx.fetch(`/api/admin/therapists/${therapistId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...adminHeaders(session) },
    data: { profile: { practice_address: address } },
  });
  expect(res.ok()).toBeTruthy();
}

export type SlotSpec = {
  day_of_week: number; // 0..6
  time_local: string; // HH:MM
  format: 'online' | 'in_person';
  address?: string; // optional override when in_person
  duration_minutes?: number;
  active?: boolean;
};

export async function upsertSlots(session: AdminSession, therapistId: string, slots: SlotSpec[]) {
  const res = await session.ctx.fetch(`/api/admin/therapists/${therapistId}/slots`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...adminHeaders(session) },
    data: { slots },
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return (json?.data || []) as Array<{
    id: string;
    therapist_id: string;
    day_of_week: number;
    time_local: string;
    format: 'online' | 'in_person';
    address: string;
    duration_minutes: number;
    active: boolean;
  }>;
}

export async function listSlots(session: AdminSession, therapistId: string) {
  const res = await session.ctx.fetch(`/api/admin/therapists/${therapistId}/slots`, {
    headers: adminHeaders(session),
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return (json?.data || []) as Array<{
    id: string;
    therapist_id: string;
    day_of_week: number;
    time_local: string;
    format: 'online' | 'in_person';
    address: string;
    duration_minutes: number;
    active: boolean;
  }>;
}

export async function deleteSlot(session: AdminSession, therapistId: string, slotId: string) {
  const res = await session.ctx.fetch(`/api/admin/therapists/${therapistId}/slots/${slotId}`, {
    method: 'DELETE',
    headers: adminHeaders(session),
  });
  // Deletion is best-effort; ignore if already deleted or not found
  if (!res.ok()) {
    try { await res.json(); } catch {}
  }
}

// Date helpers (Europe/Berlin)
const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short' });
const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function getBerlinDayIndex(d: Date): number {
  const name = weekdayFmt.format(d);
  return weekdayIndex[name as keyof typeof weekdayIndex] ?? d.getUTCDay();
}

export function tomorrowInBerlin(offsetDays = 1): Date {
  const now = new Date();
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

export function fmtYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
