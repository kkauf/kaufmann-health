/**
 * JSON-LD schema builders for therapist profiles.
 * Enables rich snippets in Google Search and semantic understanding by AI crawlers.
 */

import type { TherapistData } from '@/lib/therapist-mapper';
import { getModalityInfo } from '@/lib/modalities';
import { getSchwerpunktLabel } from '@/lib/schwerpunkte';

interface TherapistJsonLdOptions {
  baseUrl: string;
  slug: string;
}

/**
 * Build Person + HealthBusiness JSON-LD for a therapist profile page.
 */
export function buildTherapistJsonLd(
  therapist: TherapistData,
  options: TherapistJsonLdOptions
) {
  const { baseUrl, slug } = options;
  const profileUrl = `${baseUrl}/therapeuten/${slug}`;
  
  // Map modalities to human-readable labels
  const modalityLabels = (therapist.modalities || []).map(m => getModalityInfo(m).label);
  
  // Map schwerpunkte to human-readable labels
  const schwerpunkteLabels = (therapist.schwerpunkte || []).map(s => getSchwerpunktLabel(s));
  
  // Combine specializations for knowsAbout
  const knowsAbout = [...modalityLabels, ...schwerpunkteLabels];
  
  // Build address object
  const practiceAddress = therapist.metadata?.profile?.practice_address;
  const addressObject = {
    '@type': 'PostalAddress' as const,
    addressLocality: therapist.city,
    addressCountry: 'DE',
    ...(practiceAddress ? { streetAddress: practiceAddress } : {}),
  };

  // Person schema
  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${profileUrl}#person`,
    name: `${therapist.first_name} ${therapist.last_name}`,
    givenName: therapist.first_name,
    familyName: therapist.last_name,
    jobTitle: therapist.metadata?.profile?.qualification || 'Körperpsychotherapeut:in',
    url: profileUrl,
    image: therapist.photo_url || undefined,
    ...(knowsAbout.length > 0 ? { knowsAbout } : {}),
    ...(therapist.languages && therapist.languages.length > 0 
      ? { knowsLanguage: therapist.languages } 
      : {}),
    workLocation: {
      '@type': 'Place',
      address: addressObject,
    },
    memberOf: {
      '@type': 'Organization',
      name: 'Kaufmann Health',
      url: baseUrl,
    },
  };

  // MedicalBusiness schema for the practice
  const medicalBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    '@id': `${profileUrl}#practice`,
    name: `Praxis ${therapist.first_name} ${therapist.last_name}`,
    url: profileUrl,
    image: therapist.photo_url || undefined,
    address: addressObject,
    ...(therapist.typical_rate ? { 
      priceRange: `€${therapist.typical_rate} pro Sitzung` 
    } : {}),
    medicalSpecialty: 'Psychotherapy',
    availableService: modalityLabels.map(label => ({
      '@type': 'MedicalTherapy',
      name: label,
      medicineSystem: 'Complementary',
    })),
    isAcceptingNewPatients: therapist.accepting_new,
  };

  return { personSchema, medicalBusinessSchema };
}

/**
 * Render JSON-LD scripts for embedding in page head.
 */
export function renderTherapistJsonLdScripts(
  therapist: TherapistData,
  options: TherapistJsonLdOptions
): string {
  const { personSchema, medicalBusinessSchema } = buildTherapistJsonLd(therapist, options);
  
  return `
<script type="application/ld+json">${JSON.stringify(personSchema)}</script>
<script type="application/ld+json">${JSON.stringify(medicalBusinessSchema)}</script>
  `.trim();
}
