export type PatientMeta = {
  city?: string;
  session_preference?: 'online' | 'in_person';
  session_preferences?: ('online' | 'in_person')[];
  issue?: string;
  specializations?: string[];
  gender_preference?: 'male' | 'female' | 'no_preference';
};

export type TherapistRowForMatch = {
  id: string;
  gender?: string | null;
  city?: string | null;
  session_preferences?: unknown;
  modalities?: unknown;
};

export type MismatchResult = {
  mismatches: { gender: boolean; location: boolean; modality: boolean };
  isPerfect: boolean;
  reasons: string[];
};

export function normalizeSpec(v: string): string {
  return String(v)
    .trim()
    .replace(/\s*\([^)]*\)/g, '') // Remove parenthetical text like "(Entwicklungstrauma)"
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function computeMismatches(patient: PatientMeta | null | undefined, therapist: TherapistRowForMatch | null | undefined): MismatchResult {
  const meta: PatientMeta = patient ?? {};
  const t = therapist ?? {} as TherapistRowForMatch;

  const prefs: ('online' | 'in_person')[] = Array.isArray(meta.session_preferences) ? meta.session_preferences : [];
  const singlePref: ('online' | 'in_person')[] = meta.session_preference ? [meta.session_preference] : [];
  const patientPrefs = new Set<string>([...prefs, ...singlePref].map((v) => String(v)));

  const tPrefsRaw: string[] = Array.isArray(t.session_preferences) ? (t.session_preferences as unknown[]).map(String) : [];
  const tPrefs = new Set<string>(tPrefsRaw);

  const patientSpecs = new Set<string>(
    (Array.isArray(meta.specializations) ? meta.specializations : []).map((s) => normalizeSpec(String(s)))
  );
  const therapistSpecs = new Set<string>(
    (Array.isArray(t.modalities) ? (t.modalities as unknown[]).map(String) : []).map((s) => normalizeSpec(String(s)))
  );

  const genderPref = meta.gender_preference;
  const therapistGender = (t.gender || '').toLowerCase();
  const genderMismatch = (genderPref === 'male' || genderPref === 'female')
    ? (therapistGender ? therapistGender !== genderPref : false)
    : false;

  const patientWantsInPerson = patientPrefs.has('in_person');
  const therapistOnlineOnly = tPrefs.size > 0 && tPrefs.has('online') && !tPrefs.has('in_person');
  const locationMismatch = patientWantsInPerson && therapistOnlineOnly;

  let modalityMismatch = false;
  if (patientSpecs.size > 0) {
    modalityMismatch = true;
    for (const s of patientSpecs) {
      if (therapistSpecs.has(s)) { modalityMismatch = false; break; }
    }
  }

  const mismatches = { gender: genderMismatch, location: locationMismatch, modality: modalityMismatch } as const;
  const isPerfect = !mismatches.gender && !mismatches.location && !mismatches.modality;

  const reasons: string[] = [];
  if (mismatches.gender) reasons.push('gender');
  if (mismatches.location) reasons.push('location');
  if (mismatches.modality) reasons.push('modality');

  return { mismatches: { ...mismatches }, isPerfect, reasons };
}
