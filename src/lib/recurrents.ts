import type { ReleveOperation } from './lcl/parseReleve.ts'
import { cleRegle, nomMarchand, typeDuClassement, type Classement } from './categories.ts'
import { ajouterJours, jourOperation } from './cycles.ts'

/** Une dépense qui revient (abonnement, prélèvement, loyer…). */
export interface Recurrent<T> {
  /** Même clé que les règles de catégorie : "-|NETFLIX" */
  cle: string
  nom: string
  classement: Classement
  /** 'abonnement' = à auditer ; 'charge' = charge fixe, juste pour info */
  section: 'abonnement' | 'charge'
  /** Coût mensuel estimé (dernier montant), en centimes positifs */
  montantMensuel: number
  derniereDate: string
  /** Nombre de mois différents où on l'a vue */
  nbMois: number
  operations: T[]
}

type Op = Pick<ReleveOperation, 'montant' | 'libelle' | 'details' | 'date' | 'dateAchat'>

const SECTION_CHARGE = new Set<Classement>(['logement', 'transport'])
/** Catégories reconnues comme récurrentes même vues une seule fois. */
const TOUJOURS_SUIVIES = new Set<Classement>(['abonnements', 'frais', 'logement'])

/**
 * Repère les dépenses récurrentes.
 * - vues sur au moins 2 mois, environ une fois par mois, montant stable (±20 %) ;
 * - ou prélèvements SEPA, abonnements, frais bancaires, logement (même vus une seule fois).
 * On ignore celles qui ne sont plus apparues depuis 2 mois (probablement terminées).
 */
export function detecterRecurrents<T extends Op>(ops: T[], classe: (o: T) => Classement, derniere: string): Recurrent<T>[] {
  const groupes = new Map<string, T[]>()
  for (const o of ops) {
    if (o.montant >= 0) continue
    const c = classe(o)
    if (typeDuClassement(c) !== 'depense' || c === 'proches') continue
    const cle = cleRegle(o)
    groupes.set(cle, [...(groupes.get(cle) ?? []), o])
  }

  const limite = ajouterJours(derniere, -62)
  const resultats: Recurrent<T>[] = []
  for (const [cle, liste] of groupes) {
    liste.sort((a, b) => jourOperation(a).localeCompare(jourOperation(b)))
    const derniereOp = liste[liste.length - 1]
    const derniereDate = jourOperation(derniereOp)
    if (derniereDate < limite) continue

    const classement = classe(derniereOp)
    const mois = new Set(liste.map((o) => jourOperation(o).slice(0, 7)))
    const montants = liste.map((o) => -o.montant).sort((a, b) => a - b)
    const mediane = montants[Math.floor(montants.length / 2)]
    const stable = montants.every((m) => Math.abs(m - mediane) <= mediane * 0.2)
    const mensuel = liste.length / mois.size <= 1.5 // pas le café du coin, acheté chaque semaine
    const reguliere = mois.size >= 2 && stable && mensuel
    const suivie = TOUJOURS_SUIVIES.has(classement) || /^PRLV/.test(derniereOp.libelle)
    if (!reguliere && !suivie) continue

    resultats.push({
      cle,
      nom: nomMarchand(derniereOp),
      classement,
      section: SECTION_CHARGE.has(classement) ? 'charge' : 'abonnement',
      montantMensuel: -derniereOp.montant,
      derniereDate,
      nbMois: mois.size,
      operations: liste,
    })
  }
  return resultats.sort((a, b) => b.montantMensuel - a.montantMensuel)
}

/** Nombre de mois entiers écoulés entre deux dates ISO (0 si moins d'un mois). */
export function moisEcoules(depuis: string, jusqua: string): number {
  const [a1, m1, j1] = depuis.split('-').map(Number)
  const [a2, m2, j2] = jusqua.split('-').map(Number)
  const n = (a2 - a1) * 12 + (m2 - m1) - (j2 < j1 ? 1 : 0)
  return Math.max(0, n)
}
