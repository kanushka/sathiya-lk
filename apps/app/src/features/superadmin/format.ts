export function formatDate(ms: number, lang: string): string {
  return new Date(ms).toLocaleDateString(lang === 'si' ? 'si-LK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
