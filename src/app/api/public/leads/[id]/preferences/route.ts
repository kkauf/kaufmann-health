import { safeJson } from '@/lib/http';

export const runtime = 'nodejs';

// EARTH-190: Deprecated in favor of Fragebogen completion + verification
export async function POST() {
  return safeJson({ data: null, error: 'Deprecated: Use Fragebogen flow (form-completed + confirmation)' }, { status: 410 });
}
