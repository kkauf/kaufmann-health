import { describe, it, expect } from 'vitest';

type TherapistData = {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string;
  modalities: string[];
  session_preferences?: string[];
  approach_text: string;
  accepting_new: boolean;
  city: string;
  availability?: { date_iso: string; time_label: string; format: 'online' | 'in_person'; address?: string }[];
};

/**
 * Ordering composable extracted from TherapistDirectory
 * EARTH-222: Therapists with availability first, then by photo
 */
function orderTherapists(therapists: TherapistData[]): TherapistData[] {
  return therapists.sort((a, b) => {
    const aHasAvailability = Array.isArray(a.availability) && a.availability.length > 0;
    const bHasAvailability = Array.isArray(b.availability) && b.availability.length > 0;

    // Primary sort: availability
    if (aHasAvailability && !bHasAvailability) return -1;
    if (!aHasAvailability && bHasAvailability) return 1;

    // Secondary sort: photo (within same availability group)
    const aHasPhoto = !!a.photo_url;
    const bHasPhoto = !!b.photo_url;

    if (aHasPhoto && !bHasPhoto) return -1;
    if (!aHasPhoto && bHasPhoto) return 1;
    return 0;
  });
}

describe('TherapistDirectory ordering (EARTH-222)', () => {
  const createTherapist = (
    id: string,
    hasAvailability: boolean,
    hasPhoto: boolean
  ): TherapistData => ({
    id,
    first_name: `First${id}`,
    last_name: `Last${id}`,
    photo_url: hasPhoto ? `https://example.com/photo-${id}.jpg` : undefined,
    modalities: ['narm'],
    session_preferences: ['online'],
    approach_text: 'Test approach',
    accepting_new: true,
    city: 'Berlin',
    availability: hasAvailability
      ? [{ date_iso: '2025-11-12', time_label: '10:00', format: 'online' }]
      : [],
  });

  it('orders therapists with availability before those without', () => {
    const therapists = [
      createTherapist('1', false, true),  // no availability, has photo
      createTherapist('2', true, true),   // has availability, has photo
      createTherapist('3', false, false), // no availability, no photo
      createTherapist('4', true, false),  // has availability, no photo
    ];

    const ordered = orderTherapists([...therapists]);

    // Therapists with availability should come first (ids 2, 4)
    expect(ordered[0].id).toBe('2'); // availability + photo
    expect(ordered[1].id).toBe('4'); // availability, no photo
    // Then therapists without availability (ids 1, 3)
    expect(ordered[2].id).toBe('1'); // no availability, has photo
    expect(ordered[3].id).toBe('3'); // no availability, no photo
  });

  it('within availability group, orders by photo', () => {
    const therapists = [
      createTherapist('1', true, false), // has availability, no photo
      createTherapist('2', true, true),  // has availability, has photo
      createTherapist('3', true, false), // has availability, no photo
    ];

    const ordered = orderTherapists([...therapists]);

    // First should have photo
    expect(ordered[0].id).toBe('2');
    expect(ordered[0].photo_url).toBeDefined();
    // Others without photo maintain stable order
    expect(ordered[1].id).toBe('1');
    expect(ordered[2].id).toBe('3');
  });

  it('within no-availability group, orders by photo', () => {
    const therapists = [
      createTherapist('1', false, false), // no availability, no photo
      createTherapist('2', false, true),  // no availability, has photo
      createTherapist('3', false, false), // no availability, no photo
    ];

    const ordered = orderTherapists([...therapists]);

    // First should have photo
    expect(ordered[0].id).toBe('2');
    expect(ordered[0].photo_url).toBeDefined();
    // Others without photo maintain stable order
    expect(ordered[1].id).toBe('1');
    expect(ordered[2].id).toBe('3');
  });

  it('handles empty availability array as no availability', () => {
    const therapists = [
      createTherapist('1', false, true),
      { ...createTherapist('2', false, true), availability: [] },
    ];

    const ordered = orderTherapists([...therapists]);

    // Both have no availability, order by photo (both have photos, so stable)
    expect(ordered.length).toBe(2);
    expect(ordered[0].id).toBe('1');
    expect(ordered[1].id).toBe('2');
  });

  it('handles undefined availability as no availability', () => {
    const therapists = [
      createTherapist('1', false, true),
      { ...createTherapist('2', false, true), availability: undefined },
    ];

    const ordered = orderTherapists([...therapists]);

    // Both have no availability, order by photo (both have photos, so stable)
    expect(ordered.length).toBe(2);
    expect(ordered[0].id).toBe('1');
    expect(ordered[1].id).toBe('2');
  });

  it('maintains stable order when all have same availability and photo status', () => {
    const therapists = [
      createTherapist('1', true, true),
      createTherapist('2', true, true),
      createTherapist('3', true, true),
    ];

    const ordered = orderTherapists([...therapists]);

    // Should maintain input order
    expect(ordered[0].id).toBe('1');
    expect(ordered[1].id).toBe('2');
    expect(ordered[2].id).toBe('3');
  });

  it('handles mixed scenarios correctly', () => {
    const therapists = [
      createTherapist('A', false, false), // Group 4: no availability, no photo
      createTherapist('B', true, true),   // Group 1: availability + photo
      createTherapist('C', false, true),  // Group 3: no availability, has photo
      createTherapist('D', true, false),  // Group 2: availability, no photo
      createTherapist('E', true, true),   // Group 1: availability + photo
      createTherapist('F', false, false), // Group 4: no availability, no photo
    ];

    const ordered = orderTherapists([...therapists]);

    // Group 1: availability + photo (B, E)
    expect(ordered[0].id).toBe('B');
    expect(ordered[1].id).toBe('E');
    // Group 2: availability, no photo (D)
    expect(ordered[2].id).toBe('D');
    // Group 3: no availability, has photo (C)
    expect(ordered[3].id).toBe('C');
    // Group 4: no availability, no photo (A, F)
    expect(ordered[4].id).toBe('A');
    expect(ordered[5].id).toBe('F');
  });

  it('returns empty array when input is empty', () => {
    const ordered = orderTherapists([]);
    expect(ordered).toEqual([]);
  });

  it('handles single therapist correctly', () => {
    const therapists = [createTherapist('1', true, true)];
    const ordered = orderTherapists([...therapists]);
    expect(ordered.length).toBe(1);
    expect(ordered[0].id).toBe('1');
  });
});
