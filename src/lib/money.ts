// Tous les montants sont stockés en CENTIMES (nombres entiers).
// Pourquoi ? En informatique, 0.1 + 0.2 = 0.30000000000000004 :
// les nombres à virgule font des erreurs d'arrondi. Avec des entiers, jamais.

/** "1 100,00" → 110000 · "-45,90" → -4590 */
export function parseAmountToCents(text: string): number | null {
  const clean = text.replace(/[\s  ]/g, '')
  const m = clean.match(/^(-?)(\d+),(\d{2})$/)
  if (!m) return null
  const cents = Number(m[2]) * 100 + Number(m[3])
  return m[1] === '-' ? -cents : cents
}

const formatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

/** 110000 → "1 100,00 €" */
export function formatEuros(cents: number): string {
  return formatter.format(cents / 100)
}
