/** "2026-10-05" → "5 oct." */
export function formatJourCourt(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** "2026-10-05" → "octobre 2026" */
export function formatMois(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

/** "2026-10-30" → "30 octobre" */
export function formatJourLong(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}
