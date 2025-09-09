// Shared types for leads feature

export type LeadType = 'patient' | 'therapist';

export type LeadPayload = {
  name?: string;
  email: string;
  phone?: string;
  notes?: string;
  city?: string;
  issue?: string;
  availability?: string;
  budget?: string;
  specializations?: string[];
  session_preference?: 'online' | 'in_person';
  session_preferences?: ('online' | 'in_person')[];
  gender_preference?: 'male' | 'female' | 'no_preference';
  type?: LeadType;
  qualification?: string;
  experience?: string;
  website?: string;
  terms_version?: string;
  consent_share_with_therapists?: boolean;
  privacy_version?: string;
  session_id?: string;
};

export type HandlerContext = {
  req: Request;
  ip?: string;
  ua?: string;
};
