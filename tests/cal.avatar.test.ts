import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSquareAvatarUrl } from '../src/lib/cal/provision';

describe('getSquareAvatarUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://lvglocnygvmgwzdayqlc.supabase.co';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns undefined for null/undefined input', () => {
    expect(getSquareAvatarUrl(null)).toBeUndefined();
    expect(getSquareAvatarUrl(undefined)).toBeUndefined();
    expect(getSquareAvatarUrl('')).toBeUndefined();
  });

  it('transforms Supabase storage URL to square-cropped render URL', () => {
    const input = 'https://lvglocnygvmgwzdayqlc.supabase.co/storage/v1/object/public/therapist-profiles/abc123.jpg';
    const result = getSquareAvatarUrl(input);
    
    expect(result).toContain('/storage/v1/render/image/public/');
    expect(result).toContain('width=256');
    expect(result).toContain('height=256');
    expect(result).toContain('resize=cover');
  });

  it('returns external URLs unchanged', () => {
    const externalUrl = 'https://example.com/photo.jpg';
    expect(getSquareAvatarUrl(externalUrl)).toBe(externalUrl);
  });

  it('handles URLs with existing query params', () => {
    const input = 'https://lvglocnygvmgwzdayqlc.supabase.co/storage/v1/object/public/therapist-profiles/abc.jpg?token=xyz';
    const result = getSquareAvatarUrl(input);
    
    expect(result).toContain('&width=256');
  });
});
