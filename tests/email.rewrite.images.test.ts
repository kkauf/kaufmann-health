import { describe, it, expect } from 'vitest';
import { rewriteTherapistProfileImagesInHtml } from '@/lib/email/client';

describe('email client html image rewrite', () => {
  it('rewrites Supabase public object URLs to our proxy', () => {
    const html = `
      <div>
        <img src="https://lvglocnygvmgwzdayqlc.supabase.co/storage/v1/object/public/therapist-profiles/t1.jpg" />
        <img src='https://example.supabase.co/storage/v1/object/public/therapist-profiles/sub/dir/t2.png?download=1' />
      </div>
    `;
    const out = rewriteTherapistProfileImagesInHtml(html)!;
    expect(out).not.toContain('supabase.co/storage/v1/object/public/therapist-profiles/');
    expect(out).toContain('https://kaufmann-health.de/api/images/therapist-profiles/t1.jpg');
    expect(out).toContain('https://kaufmann-health.de/api/images/therapist-profiles/sub/dir/t2.png');
  });

  it('rewrites Supabase render/image URLs to our proxy', () => {
    const html = `
      <img src="https://proj.supabase.co/storage/v1/render/image/public/therapist-profiles/t3.jpg?width=56&height=56" />
    `;
    const out = rewriteTherapistProfileImagesInHtml(html)!;
    expect(out).not.toContain('supabase.co/storage/v1/render/image/public/therapist-profiles/');
    expect(out).toContain('https://kaufmann-health.de/api/images/therapist-profiles/t3.jpg');
  });
});
