"use client";

import { useMemo } from "react";

export type PatientMeta = {
  city?: string;
  session_preference?: "online" | "in_person";
  session_preferences?: ("online" | "in_person")[];
  issue?: string;
  specializations?: string[];
  gender_preference?: "male" | "female" | "no_preference";
};

export type TherapistForMatch = {
  id: string;
  gender?: string | null;
  metadata?: {
    city?: string;
    session_preferences?: string[];
    specializations?: string[];
  };
};

function normalizeSpec(v: string): string {
  return String(v)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function useMatchMismatches(patient?: PatientMeta | null, therapist?: TherapistForMatch | null) {
  return useMemo(() => {
    const meta: PatientMeta = patient ?? {};
    const t: TherapistForMatch | null = therapist ?? null;

    const prefs: ("online" | "in_person")[] = Array.isArray(meta.session_preferences) ? meta.session_preferences : [];
    const singlePref: ("online" | "in_person")[] = meta.session_preference ? [meta.session_preference] : [];
    const patientPrefs = new Set<string>([...prefs, ...singlePref].map((v) => String(v)));

    const tPrefsRaw: string[] = Array.isArray(t?.metadata?.session_preferences)
      ? (t!.metadata!.session_preferences as string[])
      : [];
    const tPrefs = new Set<string>(tPrefsRaw.map((v) => String(v)));

    const patientSpecs = new Set<string>(
      (Array.isArray(meta.specializations) ? (meta.specializations as string[]) : []).map((s: string) => normalizeSpec(String(s)))
    );
    const therapistSpecs = new Set<string>(
      (Array.isArray(t?.metadata?.specializations) ? (t!.metadata!.specializations as string[]) : []).map((s: string) => normalizeSpec(String(s)))
    );

    // Gender mismatch only when patient requires a specific gender and therapist gender is known and different
    const genderPref = meta.gender_preference;
    const therapistGender = (t?.gender || "").toLowerCase();
    const genderMismatch = (genderPref === "male" || genderPref === "female")
      ? (therapistGender ? therapistGender !== genderPref : false)
      : false;

    // Location mismatch: patient prefers in_person AND therapist is online-only (no in_person in prefs)
    const patientWantsInPerson = patientPrefs.has("in_person");
    const therapistOnlineOnly = tPrefs.size > 0 && tPrefs.has("online") && !tPrefs.has("in_person");
    const locationMismatch = patientWantsInPerson && therapistOnlineOnly;

    // Modality mismatch: patient has any specialization AND intersection with therapist specs is empty
    let modalityMismatch = false;
    if (patientSpecs.size > 0) {
      modalityMismatch = true;
      for (const s of patientSpecs) {
        if (therapistSpecs.has(s)) { modalityMismatch = false; break; }
      }
    }

    const mismatches = { gender: genderMismatch, location: locationMismatch, modality: modalityMismatch };
    const isPerfect = !mismatches.gender && !mismatches.location && !mismatches.modality;

    const reasons: string[] = [];
    if (mismatches.gender) reasons.push("Geschlecht");
    if (mismatches.location) reasons.push("Ort/Sitzung");
    if (mismatches.modality) reasons.push("Methode");

    return { mismatches, isPerfect, reasons } as const;
  }, [patient, therapist]);
}
