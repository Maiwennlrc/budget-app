import type { ReleveOperation } from './lcl/parseReleve.ts'
import { typeOperation } from './classement.ts'

// Un « mois budgétaire » va d'une paie à la veille de la paie suivante.

export interface Cycle {
  /** Premier jour, ISO "2026-10-29" */
  debut: string
  /** Dernier jour inclus */
  fin: string
  /** true si le début a été deviné (pas de salaire trouvé ce mois-là) */
  debutEstime: boolean
}

type Op = Pick<ReleveOperation, 'date' | 'dateAchat' | 'montant' | 'libelle' | 'details'>

/** La date « réelle » d'une opération : date d'achat pour la carte, sinon date de l'opération. */
export const jourOperation = (o: Pick<ReleveOperation, 'date' | 'dateAchat'>) => o.dateAchat ?? o.date

// --- petites fonctions de dates (en UTC pour éviter les surprises d'heure d'été) ---
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`)
const toIso = (d: Date) => d.toISOString().slice(0, 10)
export function ajouterJours(iso: string, n: number): string {
  const d = toDate(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return toIso(d)
}
export function ecartJours(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000)
}
function ajouterMois(iso: string, n: number): string {
  const d = toDate(iso)
  const jour = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  const dernierJour = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(jour, dernierJour))
  return toIso(d)
}

/**
 * Repère le salaire : le payeur qui verse le plus d'argent au total (virements ≥ 300 €),
 * puis garde ses gros versements (≥ la moitié du plus gros), un par mois.
 */
export function detecterSalaires(ops: Op[]): { payeur: string | null; dates: string[] } {
  const parPayeur = new Map<string, Op[]>()
  for (const o of ops) {
    if (typeOperation(o) !== 'revenu' || o.montant < 30_000) continue
    const cle = o.libelle.trim().toUpperCase()
    parPayeur.set(cle, [...(parPayeur.get(cle) ?? []), o])
  }
  let payeur: string | null = null
  let meilleur = 0
  for (const [cle, liste] of parPayeur) {
    const total = liste.reduce((s, o) => s + o.montant, 0)
    if (total > meilleur) {
      meilleur = total
      payeur = cle
    }
  }
  if (!payeur) return { payeur: null, dates: [] }

  const versements = ops.filter((o) => o.montant > 0 && o.libelle.trim().toUpperCase() === payeur)
  const max = Math.max(...versements.map((o) => o.montant))
  const dates = versements
    .filter((o) => o.montant >= max / 2)
    .map((o) => o.date)
    .sort()
  // Un seul salaire par période de ~3 semaines (évite un double versement le même mois).
  const uniques: string[] = []
  for (const d of dates) if (!uniques.length || ecartJours(uniques[uniques.length - 1], d) > 20) uniques.push(d)
  return { payeur, dates: uniques }
}

/** Découpe toute la période couverte par les opérations en mois de paie. */
export function construireCycles(ops: Op[], jusquau: string): Cycle[] {
  if (ops.length === 0) return []
  const jours = ops.map(jourOperation).sort()
  const premier = jours[0]
  const dernier = jusquau > jours[jours.length - 1] ? jusquau : jours[jours.length - 1]

  const { dates } = detecterSalaires(ops)
  // Sans salaire repéré : mois calendaires classiques.
  const debuts: { date: string; estime: boolean }[] = dates.length
    ? dates.map((date) => ({ date, estime: false }))
    : [{ date: `${premier.slice(0, 7)}-01`, estime: true }]

  // Remonter dans le temps pour couvrir les opérations plus anciennes que le 1er salaire connu.
  while (debuts[0].date > premier) debuts.unshift({ date: ajouterMois(debuts[0].date, -1), estime: true })

  // Combler les mois où le salaire n'a pas été trouvé, et prolonger jusqu'à la dernière opération.
  const complets: typeof debuts = []
  for (let i = 0; i < debuts.length; i++) {
    complets.push(debuts[i])
    const suivant = debuts[i + 1]?.date
    let d = debuts[i].date
    while (suivant ? ecartJours(d, suivant) > 40 : ajouterMois(d, 1) <= dernier) {
      d = ajouterMois(d, 1)
      complets.push({ date: d, estime: true })
    }
  }

  return complets.map((c, i) => ({
    debut: c.date,
    fin: ajouterJours(complets[i + 1]?.date ?? ajouterMois(c.date, 1), -1),
    debutEstime: c.estime,
  }))
}

export interface BilanCycle {
  depense: number
  revenus: number
  epargne: number
  remboursements: number
}

/** Les totaux d'une période (montants positifs, en centimes). */
export function bilan(ops: Op[], debut: string, fin: string): BilanCycle {
  const b: BilanCycle = { depense: 0, revenus: 0, epargne: 0, remboursements: 0 }
  for (const o of ops) {
    const j = jourOperation(o)
    if (j < debut || j > fin) continue
    switch (typeOperation(o)) {
      case 'depense':
        b.depense += -o.montant
        break
      case 'epargne':
        b.epargne += -o.montant
        break
      case 'revenu':
        b.revenus += o.montant
        break
      case 'remboursement':
        b.remboursements += o.montant
        break
    }
  }
  // Les remboursements des amis viennent diminuer ce qu'on a dépensé.
  b.depense -= b.remboursements
  return b
}
