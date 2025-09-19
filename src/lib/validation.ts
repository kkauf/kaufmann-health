export function getEmailError(value: string | undefined | null): string | null {
  const email = (value ?? '').trim();
  if (!email) return 'Bitte gib deine E‑Mail‑Adresse ein.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Bitte gib eine gültige E‑Mail‑Adresse ein.';
  return null;
}
