// Shared types for leads feature

export type LeadType = 'patient' | 'therapist';

export type LeadPayload = {
  name?: string;
  email?: string; // Optional now that we support phone_number as primary contact
  phone?: string;
  phone_number?: string; // EARTH-191: E.164 format for SMS verification
  notes?: string;
  city?: string;
  issue?: string;
  availability?: string;
  budget?: string;
  specializations?: string[];
  session_preference?: 'online' | 'in_person';
  session_preferences?: ('online' | 'in_person')[];
  gender_preference?: 'male' | 'female' | 'no_preference';
  gender?: 'male' | 'female' | 'non-binary'; // Therapist's own gender
  type?: LeadType;
  qualification?: string;
  experience?: string;
  website?: string;
  terms_version?: string;
  consent_share_with_therapists?: boolean;
  privacy_version?: string;
  session_id?: string;
  // EARTH-190: optional linkage for email-first wizard flow
  form_session_id?: string;
  confirm_redirect_path?: string;
  // EARTH-191: SMS verification support
  verification_code?: string; // 6-digit SMS code for verification
  contact_method?: 'email' | 'phone'; // Which method user chose
  // Progressive flow: upgrade anonymous patient record
  anonymous_patient_id?: string;
};

export type HandlerContext = {
  req: Request;
  ip?: string;
  ua?: string;
};
