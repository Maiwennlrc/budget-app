import { parseAmountToCents } from '../money.ts'

/** Un morceau de texte du PDF, avec sa position sur la page (en points, origine en bas à gauche). */
export interface PdfTextItem {
  str: string
  x: number
  y: number
  width: number
}

export interface ReleveOperation {
  /** Date de comptabilisation, format ISO "2026-10-05" */
  date: string
  /** Date de valeur ISO */
  dateValeur: string
  /** Date d'achat réelle pour les paiements carte ("CB XXX 03/10/26"), sinon null */
  dateAchat: string | null
  /** Première ligne du libellé, telle qu'écrite par LCL */
  libelle: string
  /** Lignes de détail (LIBELLE:, REF.CLIENT:, ID.CREANCIER:, ville…) */
  details: string[]
  /** Montant en centimes : négatif = débit, positif = crédit */
  montant: number
  /** Montant d'origine si payé en devise étrangère, ex. { devise: 'GBP', montant: 1900 } */
  devise: { devise: string; montant: number } | null
  /** Identifiant du créancier pour les prélèvements SEPA (idéal pour repérer les abonnements) */
  idCreancier: string | null
}

export interface Releve {
  periodeDebut: string | null
  periodeFin: string | null
  ancienSolde: number | null
  nouveauSolde: number | null
  totalDebit: number | null
  totalCredit: number | null
  operations: ReleveOperation[]
  /** true si ancien solde + crédits − débits = nouveau solde, au centime près */
  soldeVerifie: boolean
  /** Écart constaté (0 si tout va bien) */
  ecart: number | null
}

interface Line {
  y: number
  items: PdfTextItem[]
}

const RE_DATE_COURTE = /^\d{2}\.\d{2}$/
const RE_DATE_VALEUR = /^(\d{2})\.(\d{2})\.(\d{2})$/
const RE_MONTANT = /^-?\d{1,3}(?:[   ]\d{3})*,\d{2}$/
const RE_PERIODE = /du (\d{2})\.(\d{2})\.(\d{4}) au (\d{2})\.(\d{2})\.(\d{4})/
const RE_DATE_CB = /^CB .*?(\d{2})\/(\d{2})\/(\d{2})\s*$/
const RE_DEVISE = /\b([A-Z]{3})\s+(\d{1,3}(?:[  ]\d{3})*,\d{2})\s*$/

/** Regroupe les morceaux de texte qui sont sur la même ligne (même hauteur, à 2 points près). */
function groupLines(items: PdfTextItem[]): Line[] {
  const sorted = items
    .filter((i) => i.str.trim() !== '')
    .sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: Line[] = []
  for (const item of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - item.y) <= 2) last.items.push(item)
    else lines.push({ y: item.y, items: [item] })
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x)
  return lines
}

function lineText(line: Line): string {
  return line.items.map((i) => i.str.trim()).join(' ')
}

/** Colonnes repérées grâce à la ligne d'en-tête « DATE LIBELLE VALEUR DEBIT CREDIT ». */
interface Columns {
  valeurX: number
  /** Un montant dont le bord droit dépasse cette limite est dans la colonne CREDIT. */
  seuilCredit: number
}

function findColumns(line: Line): Columns | null {
  const get = (s: string) => line.items.find((i) => i.str.trim() === s)
  const date = get('DATE')
  const valeur = get('VALEUR')
  const debit = get('DEBIT')
  const credit = get('CREDIT')
  if (!date || !valeur || !debit || !credit) return null
  const finDebit = debit.x + debit.width
  const finCredit = credit.x + credit.width
  return { valeurX: valeur.x, seuilCredit: (finDebit + finCredit) / 2 }
}

/** Trouve le montant de la ligne et son sens (débit → négatif, crédit → positif). */
function readAmount(line: Line, cols: Columns): number | null {
  const amounts = line.items.filter((i) => i.x > cols.valeurX && RE_MONTANT.test(i.str.trim()))
  if (amounts.length === 0) return null
  const item = amounts[amounts.length - 1]
  const cents = parseAmountToCents(item.str)
  if (cents === null) return null
  const estCredit = item.x + item.width > cols.seuilCredit
  return estCredit ? cents : -cents
}

function isoFromValeur(jjmm: string, valeur: string): { date: string; dateValeur: string } {
  const [, vj, vm, va] = valeur.match(RE_DATE_VALEUR)!
  let annee = 2000 + Number(va)
  const [j, m] = jjmm.split('.').map(Number)
  // Opération du 31/12 avec une valeur au 02/01 : l'opération est de l'année précédente.
  if (m === 12 && Number(vm) === 1) annee -= 1
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${annee}-${pad(m)}-${pad(j)}`,
    dateValeur: `${2000 + Number(va)}-${vm}-${vj}`,
  }
}

/**
 * Lit un relevé de compte LCL (PDF déjà découpé en morceaux de texte, une liste par page).
 * Fonction « pure » : pas d'accès au navigateur, donc facile à tester.
 */
export function parseReleveLcl(pages: PdfTextItem[][]): Releve {
  const releve: Releve = {
    periodeDebut: null,
    periodeFin: null,
    ancienSolde: null,
    nouveauSolde: null,
    totalDebit: null,
    totalCredit: null,
    operations: [],
    soldeVerifie: false,
    ecart: null,
  }

  let termine = false
  for (const items of pages) {
    if (termine) break
    let cols: Columns | null = null // on n'est « dans le tableau » qu'après l'en-tête de colonnes
    let current: ReleveOperation | null = null

    for (const line of groupLines(items)) {
      const text = lineText(line)

      if (!releve.periodeDebut) {
        const p = text.match(RE_PERIODE)
        if (p) {
          releve.periodeDebut = `${p[3]}-${p[2]}-${p[1]}`
          releve.periodeFin = `${p[6]}-${p[5]}-${p[4]}`
        }
      }

      if (!cols) {
        cols = findColumns(line)
        continue
      }

      // Bas de page : on arrête de lire jusqu'à l'en-tête de la page suivante.
      if (/^Page \d+ \/ \d+$/.test(text)) {
        cols = null
        current = null
        continue
      }

      if (text.includes('ANCIEN SOLDE')) {
        releve.ancienSolde = readAmount(line, cols)
        continue
      }
      if (text.startsWith('TOTAUX')) {
        const montants = line.items.filter((i) => RE_MONTANT.test(i.str.trim()))
        for (const m of montants) {
          const cents = parseAmountToCents(m.str)
          if (m.x + m.width > cols.seuilCredit) releve.totalCredit = cents
          else releve.totalDebit = cents
        }
        current = null
        continue
      }
      if (text.includes('SOLDE EN EUROS')) {
        releve.nouveauSolde = readAmount(line, cols)
        termine = true
        break
      }

      const first = line.items[0]
      const valeur = line.items.find((i) => RE_DATE_VALEUR.test(i.str.trim()))
      const isOperation = RE_DATE_COURTE.test(first.str.trim()) && valeur !== undefined

      if (isOperation) {
        const montant = readAmount(line, cols)
        if (montant === null) continue
        const libelle = line.items
          .filter((i) => i !== first && i.x < cols!.valeurX)
          .map((i) => i.str.trim())
          .join(' ')
        const { date, dateValeur } = isoFromValeur(first.str.trim(), valeur.str.trim())
        const cb = libelle.match(RE_DATE_CB)
        current = {
          date,
          dateValeur,
          dateAchat: cb ? `20${cb[3]}-${cb[2]}-${cb[1]}` : null,
          libelle,
          details: [],
          montant,
          devise: null,
          idCreancier: null,
        }
        releve.operations.push(current)
        continue
      }

      // Sinon : ligne de détail de l'opération précédente (on ignore ce qui déborde à droite).
      if (current) {
        const detail = line.items
          .filter((i) => i.x < cols!.valeurX)
          .map((i) => i.str.trim())
          .join(' ')
          .replace(/\s+/g, ' ')
        if (!detail) continue
        current.details.push(detail)
        const dev = detail.match(RE_DEVISE)
        if (dev && dev[1] !== 'EUR') {
          current.devise = { devise: dev[1], montant: parseAmountToCents(dev[2]) ?? 0 }
        }
        const cre = detail.match(/^ID\.CREANCIER:\s*(\S+)/)
        if (cre) current.idCreancier = cre[1]
      }
    }
  }

  if (releve.ancienSolde !== null && releve.nouveauSolde !== null) {
    const somme = releve.operations.reduce((s, o) => s + o.montant, 0)
    releve.ecart = releve.ancienSolde + somme - releve.nouveauSolde
    releve.soldeVerifie = releve.ecart === 0
  }
  return releve
}
