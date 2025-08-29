export function getEmailError(value: string | undefined | null): string | null {
  const email = (value ?? '').trim();
  if (!email) return 'Bitte geben Sie Ihre E‑Mail-Adresse ein.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Bitte geben Sie eine gültige E‑Mail-Adresse ein.';
  return null;
}
