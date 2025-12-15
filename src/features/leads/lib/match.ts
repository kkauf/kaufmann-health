// Note: supabaseServer and track are imported dynamically inside createInstantMatchesForPatient
// to avoid module-level initialization issues in test environments

export type PatientMeta = {
  city?: string;
  session_preference?: 'online' | 'in_person';
  session_preferences?: ('online' | 'in_person')[];
  issue?: string;
  specializations?: string[];
  schwerpunkte?: string[]; // New: client focus area selections
  gender_preference?: 'male' | 'female' | 'no_preference';
};

export type TherapistRowForMatch = {
  id: string;
  gender?: string | null;
  city?: string | null;
  session_preferences?: unknown;
  modalities?: unknown;
  schwerpunkte?: unknown; // New: therapist focus areas
};

export type MismatchResult = {
  mismatches: { gender: boolean; location: boolean; city: boolean; modality: boolean; schwerpunkte: boolean };
  isPerfect: boolean;
  reasons: string[];
  schwerpunkteOverlap: number; // Number of matching categories
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
  const therapistOffersInPerson = tPrefs.has('in_person');
  
  // Location mismatch: therapist is online-only but patient wants in-person
  const locationMismatch = patientWantsInPerson && therapistOnlineOnly;
  
  // City mismatch: only matters if patient ONLY wants in-person (not also accepting online)
  // If patient accepts online, city is irrelevant since they can work with anyone online
  const patientCity = normalizeSpec(meta.city || '');
  const therapistCity = normalizeSpec(t.city || '');
  const patientOnlyWantsInPerson = patientWantsInPerson && !patientPrefs.has('online');
  const cityMismatch = Boolean(
    patientOnlyWantsInPerson && 
    therapistOffersInPerson && 
    patientCity && 
    therapistCity && 
    patientCity !== therapistCity
  );

  let modalityMismatch = false;
  if (patientSpecs.size > 0) {
    modalityMismatch = true;
    for (const s of patientSpecs) {
      if (therapistSpecs.has(s)) { modalityMismatch = false; break; }
    }
  }

  // Calculate schwerpunkte overlap
  const patientSchwerpunkte = new Set<string>(
    Array.isArray(meta.schwerpunkte) ? meta.schwerpunkte : []
  );
  const therapistSchwerpunkte = new Set<string>(
    Array.isArray(t.schwerpunkte) ? (t.schwerpunkte as string[]) : []
  );
  
  let schwerpunkteOverlap = 0;
  for (const s of patientSchwerpunkte) {
    if (therapistSchwerpunkte.has(s)) schwerpunkteOverlap++;
  }
  
  // Schwerpunkte mismatch: patient selected schwerpunkte but therapist has none matching
  const schwerpunkteMismatch = patientSchwerpunkte.size > 0 && schwerpunkteOverlap === 0;

  const mismatches = { gender: genderMismatch, location: locationMismatch, city: cityMismatch, modality: modalityMismatch, schwerpunkte: schwerpunkteMismatch } as const;
  const isPerfect = !mismatches.gender && !mismatches.location && !mismatches.city && !mismatches.modality && !mismatches.schwerpunkte;

  const reasons: string[] = [];
  // City mismatch is the most severe for in-person - list it first
  if (mismatches.city) reasons.push('city');
  if (mismatches.gender) reasons.push('gender');
  if (mismatches.location) reasons.push('location');
  if (mismatches.modality) reasons.push('modality');
  if (mismatches.schwerpunkte) reasons.push('schwerpunkte');

  return { mismatches: { ...mismatches }, isPerfect, reasons, schwerpunkteOverlap };
}

/**
 * Create instant matches for a patient based on their preferences
 * Returns secure match UUID for browsing therapists
 */
export async function createInstantMatchesForPatient(patientId: string, variant?: string): Promise<{ matchesUrl: string; matchQuality: 'exact' | 'partial' | 'none' } | null> {
  try {
    const isConcierge = variant === 'concierge';
    if (process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW !== 'true' && !isConcierge) return null;
    
    // Dynamic import to avoid module-level initialization in tests
    const { supabaseServer } = await import('@/lib/supabase-server');
    
    type PersonRow = { id: string; metadata?: Record<string, unknown> | null };
    const { data: person } = await supabaseServer
      .from('people')
      .select('id, metadata')
      .eq('id', patientId)
      .single<PersonRow>();
    
    const meta = (person?.metadata || {}) as Record<string, unknown>;
    const isTest = meta['is_test'] === true;
    const city = typeof meta['city'] === 'string' ? (meta['city'] as string) : undefined;
    const session_preference = typeof meta['session_preference'] === 'string' ? (meta['session_preference'] as string) as 'online' | 'in_person' : undefined;
    const session_preferences = Array.isArray(meta['session_preferences']) ? (meta['session_preferences'] as ('online' | 'in_person')[]) : undefined;
    const specializations = Array.isArray(meta['specializations']) ? (meta['specializations'] as string[]) : undefined;
    const schwerpunkte = Array.isArray(meta['schwerpunkte']) ? (meta['schwerpunkte'] as string[]) : undefined;
    const gender_preference = typeof meta['gender_preference'] === 'string' ? (meta['gender_preference'] as 'male' | 'female' | 'no_preference') : undefined;
    const time_slots = Array.isArray(meta['time_slots']) ? (meta['time_slots'] as string[]) : [];
    const pMeta: PatientMeta = { city, session_preference, session_preferences, specializations, schwerpunkte, gender_preference };

    type TR = { id: string; gender?: string | null; city?: string | null; session_preferences?: unknown; modalities?: unknown; schwerpunkte?: unknown; accepting_new?: boolean | null; metadata?: Record<string, unknown> | null };
    const { data: trows } = await supabaseServer
      .from('therapists')
      .select('id, gender, city, session_preferences, modalities, schwerpunkte, accepting_new, metadata')
      .eq('status', 'verified')
      .limit(5000);
    const therapists = Array.isArray(trows) ? (trows as TR[]) : [];

    const tIds = therapists.map(t => t.id);
    type SlotRow = { therapist_id: string; day_of_week: number; time_local: string; format: string; address: string | null; active: boolean | null };
    let slotsByTid = new Map<string, SlotRow[]>();
    try {
      if (tIds.length > 0) {
        const { data: srows } = await supabaseServer
          .from('therapist_slots')
          .select('therapist_id, day_of_week, time_local, format, address, active')
          .in('therapist_id', tIds)
          .eq('active', true)
          .limit(5000);
        if (Array.isArray(srows)) {
          for (const s of srows as SlotRow[]) {
            const arr = slotsByTid.get(s.therapist_id) || [];
            arr.push(s);
            slotsByTid.set(s.therapist_id, arr);
          }
        }
      }
    } catch { slotsByTid = new Map(); }

    function slotMatchesPreferences(therapistId: string): boolean {
      const prefs = new Set((time_slots || []).map((s) => String(s)));
      if (prefs.size === 0 || prefs.has('Bin flexibel')) return true;
      const wantMorning = Array.from(prefs).some((s) => s.toLowerCase().includes('morg'));
      const wantAfternoon = Array.from(prefs).some((s) => s.toLowerCase().includes('nachmitt'));
      const wantEvening = Array.from(prefs).some((s) => s.toLowerCase().includes('abend'));
      const wantWeekend = Array.from(prefs).some((s) => s.toLowerCase().includes('wochen'));
      const slots = slotsByTid.get(therapistId) || [];
      const now = new Date();
      for (let offset = 1; offset <= 21; offset++) {
        const d = new Date(now.getTime());
        d.setUTCDate(d.getUTCDate() + offset);
        const dow = d.getUTCDay();
        for (const s of slots) {
          if (Number(s.day_of_week) !== (dow === 0 ? 0 : dow)) continue;
          const h = parseInt(String(s.time_local || '').slice(0, 2), 10);
          const isMorning = h >= 8 && h < 12;
          const isAfternoon = h >= 12 && h < 17;
          const isEvening = h >= 17 && h < 21;
          const isWeekend = dow === 0 || dow === 6;
          if ((wantMorning && isMorning) || (wantAfternoon && isAfternoon) || (wantEvening && isEvening) || (wantWeekend && isWeekend)) return true;
        }
      }
      return false;
    }

    const scored: { id: string; isPerfect: boolean; reasons: string[]; accepting: boolean; schwerpunkteOverlap: number }[] = [];
    for (const t of therapists) {
      if (t.accepting_new === false) continue;
      const tMeta = (t.metadata || {}) as Record<string, unknown>;
      const hideFromDir = tMeta['hide_from_directory'] === true;
      if (hideFromDir) continue;

      const tRow: TherapistRowForMatch = { id: t.id, gender: t.gender || undefined, city: t.city || undefined, session_preferences: t.session_preferences, modalities: t.modalities, schwerpunkte: t.schwerpunkte };
      const mm = computeMismatches(pMeta, tRow);
      const timeOk = slotMatchesPreferences(t.id);
      const isPerfect = mm.isPerfect && timeOk;
      scored.push({ id: t.id, isPerfect, reasons: mm.reasons, accepting: Boolean(t.accepting_new), schwerpunkteOverlap: mm.schwerpunkteOverlap });
    }

    scored.sort((a, b) => {
      if (a.isPerfect !== b.isPerfect) return a.isPerfect ? -1 : 1;
      if (a.accepting !== b.accepting) return a.accepting ? -1 : 1;
      // Modality match is most important - penalize modality mismatch heavily
      const aModality = a.reasons.includes('modality') ? 1 : 0;
      const bModality = b.reasons.includes('modality') ? 1 : 0;
      if (aModality !== bModality) return aModality - bModality;
      // Sort by schwerpunkte overlap (descending - more matches first)
      if (a.schwerpunkteOverlap !== b.schwerpunkteOverlap) return b.schwerpunkteOverlap - a.schwerpunkteOverlap;
      // Then by total reasons count
      return a.reasons.length - b.reasons.length;
    });
    const chosenScored = scored.slice(0, 3);
    const chosen = chosenScored.map(s => s.id);

    console.log(`[InstantMatch] Patient ${patientId}: Found ${therapists.length} verified therapists. Scored ${scored.length} candidates. Chosen ${chosen.length}.`);

    const hasAnyPerfect = chosenScored.some(s => s.isPerfect);
    const matchQuality = chosen.length === 0 ? 'none' : (hasAnyPerfect ? 'exact' : 'partial');

    let secureUuid: string | null = null;
    if (chosen.length === 0) {
      const { data: ref } = await supabaseServer
        .from('matches')
        .insert({
          patient_id: patientId,
          status: 'proposed',
          metadata: { match_quality: matchQuality, ...(isTest ? { is_test: true } : {}) },
        })
        .select('secure_uuid')
        .single();
      secureUuid = (ref as { secure_uuid?: string | null } | null)?.secure_uuid || null;
    } else {
      for (let i = 0; i < chosen.length; i++) {
        const tid = chosen[i];
        const therapistQuality = chosenScored[i].isPerfect ? 'exact' : 'partial';
        const { data: row } = await supabaseServer
          .from('matches')
          .insert({
            patient_id: patientId,
            therapist_id: tid,
            status: 'proposed',
            metadata: { match_quality: matchQuality, therapist_match_quality: therapistQuality, ...(isTest ? { is_test: true } : {}) }
          })
          .select('secure_uuid')
          .single();
        if (i === 0) secureUuid = (row as { secure_uuid?: string | null } | null)?.secure_uuid || secureUuid;
      }
    }

    // Business opportunity tracking - log supply gaps for analytics
    try {
      const { track } = await import('@/lib/logger');
      const wantsInPerson = Boolean(
        (Array.isArray(session_preferences) && session_preferences.includes('in_person')) ||
        session_preference === 'in_person'
      );

      // Gather mismatch reasons from chosen therapists
      const uniqueReasons = new Set<string>();
      for (const s of chosenScored) {
        for (const reason of s.reasons) uniqueReasons.add(reason);
      }
      const reasonsArr = Array.from(uniqueReasons).filter(r => r === 'gender' || r === 'location' || r === 'modality');

      // Calculate slot availability for chosen therapists
      let total_in_person_slots = 0;
      let total_online_slots = 0;
      for (const s of chosenScored) {
        const rows = slotsByTid.get(s.id) || [];
        for (const row of rows) {
          const fmt = String(row.format || '').trim();
          if (fmt === 'in_person' || fmt === 'both') total_in_person_slots++;
          if (fmt === 'online' || fmt === 'both') total_online_slots++;
        }
      }

      // Analyze supply gaps
      const topTherapists = therapists.filter(t => chosen.includes(t.id));
      const topGenders = Array.from(new Set(topTherapists.map(t => String(t.gender || '').toLowerCase()).filter(Boolean)));
      const topModalitiesRaw: string[] = Array.from(new Set(topTherapists.flatMap(t => Array.isArray(t.modalities) ? (t.modalities as string[]) : []))).filter(Boolean);
      const topModalities = Array.from(new Set(topModalitiesRaw.map(m => normalizeSpec(String(m)))));
      const wantedSpecs = Array.isArray(specializations) ? specializations.map(s => normalizeSpec(String(s))) : [];
      const hasGenderPref = gender_preference === 'male' || gender_preference === 'female';
      const preferredGender = hasGenderPref ? String(gender_preference) : undefined;
      const missingPreferredGender = Boolean(hasGenderPref && preferredGender && !topGenders.includes(preferredGender));
      const missingRequestedModalities = wantedSpecs.filter(w => !topModalities.includes(w));

      const insights: string[] = [];
      if (wantsInPerson && total_in_person_slots === 0) insights.push('in_person_supply_gap');
      if (missingPreferredGender) insights.push('gender_supply_gap');
      if (missingRequestedModalities.length > 0) insights.push('modality_supply_gap');
      if (missingPreferredGender && missingRequestedModalities.length > 0) insights.push('combo_gender_modality_gap');
      if (missingPreferredGender && wantsInPerson && total_in_person_slots === 0) insights.push('combo_gender_in_person_gap');

      // Check for schwerpunkte gaps
      const wantedSchwerpunkte = schwerpunkte || [];
      const topSchwerpunkteRaw: string[] = Array.from(new Set(topTherapists.flatMap(t => Array.isArray(t.schwerpunkte) ? (t.schwerpunkte as string[]) : []))).filter(Boolean);
      const missingSchwerpunkte = wantedSchwerpunkte.filter(s => !topSchwerpunkteRaw.includes(s));
      if (missingSchwerpunkte.length > 0) insights.push('schwerpunkte_supply_gap');

      // Generate actionable demand signals for recruiting
      const demandSignals: string[] = [];
      const locationPart = city ? ` in ${city}` : '';
      const formatPart = wantsInPerson && total_in_person_slots === 0 ? ' (vor Ort)' : '';
      const genderPart = missingPreferredGender && preferredGender ? (preferredGender === 'male' ? 'männlichen ' : 'weibliche ') : '';
      
      // Generate specific demand signals for each missing combination
      if (missingRequestedModalities.length > 0) {
        for (const mod of missingRequestedModalities) {
          demandSignals.push(`${genderPart}${mod}-Therapeut:in${formatPart}${locationPart}`);
        }
      }
      if (missingSchwerpunkte.length > 0) {
        for (const sp of missingSchwerpunkte) {
          demandSignals.push(`Spezialist:in für ${sp}${formatPart}${locationPart}`);
        }
      }
      // Gender-only demand
      if (missingPreferredGender && missingRequestedModalities.length === 0 && missingSchwerpunkte.length === 0) {
        demandSignals.push(`${genderPart}Therapeut:in${formatPart}${locationPart}`);
      }
      // In-person-only demand
      if (wantsInPerson && total_in_person_slots === 0 && !missingPreferredGender && missingRequestedModalities.length === 0 && missingSchwerpunkte.length === 0) {
        demandSignals.push(`Therapeut:in vor Ort${locationPart}`);
      }

      // Insert actionable supply gaps (what specific combination couldn't be fulfilled)
      // E.g., "female NARM therapist in Berlin (in-person)"
      const supplyGapRows: { city?: string; gender?: string; modality?: string; schwerpunkt?: string; session_type?: string; patient_id: string }[] = [];
      
      const sessionTypeForGap = wantsInPerson ? 'in_person' : 'online';
      const cityForGap = (wantsInPerson && city) ? city : undefined;
      
      // Log each missing modality as a gap
      for (const mod of missingRequestedModalities) {
        supplyGapRows.push({
          city: cityForGap,
          gender: missingPreferredGender ? preferredGender : undefined,
          modality: mod,
          session_type: sessionTypeForGap,
          patient_id: patientId,
        });
      }
      
      // Log each missing schwerpunkt as a gap
      for (const sp of missingSchwerpunkte) {
        supplyGapRows.push({
          city: cityForGap,
          gender: missingPreferredGender ? preferredGender : undefined,
          schwerpunkt: sp,
          session_type: sessionTypeForGap,
          patient_id: patientId,
        });
      }
      
      // If only gender mismatch (no modality/schwerpunkt), log gender-only gap
      if (missingPreferredGender && missingRequestedModalities.length === 0 && missingSchwerpunkte.length === 0) {
        supplyGapRows.push({
          city: cityForGap,
          gender: preferredGender,
          session_type: sessionTypeForGap,
          patient_id: patientId,
        });
      }
      
      if (supplyGapRows.length > 0) {
        await supabaseServer.from('supply_gaps').insert(supplyGapRows).select('id').limit(1).maybeSingle();
      }

      // Log tracking event with actionable demand signals
      if (reasonsArr.length > 0 || insights.length > 0 || demandSignals.length > 0) {
        void track({
          type: 'business_opportunity_logged',
          source: 'match.createInstantMatchesForPatient',
          props: {
            patient_id: patientId,
            reasons: reasonsArr,
            insights,
            demand_signals: demandSignals,
            details: {
              wants_in_person: wantsInPerson,
              total_in_person_slots,
              total_online_slots,
              preferred_gender: preferredGender || null,
              top_genders: topGenders,
              top_modalities: topModalities,
              missing_requested_modalities: missingRequestedModalities,
              missing_schwerpunkte: missingSchwerpunkte,
              wanted_schwerpunkte: wantedSchwerpunkte,
              city: city || null,
            },
          },
        });
      }
    } catch { /* Tracking failure should not break matching */ }

    return secureUuid ? { matchesUrl: `/matches/${encodeURIComponent(String(secureUuid))}`, matchQuality } : null;
  } catch {
    return null;
  }
}
