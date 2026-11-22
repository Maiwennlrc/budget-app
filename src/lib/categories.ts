import type { ReleveOperation } from './lcl/parseReleve.ts'
import { typeOperation, type TypeOperation } from './classement.ts'

// ---------------------------------------------------------------------------
// 1. Les catégories
// ---------------------------------------------------------------------------

export type CategorieId =
  | 'logement'
  | 'courses'
  | 'restos'
  | 'transport'
  | 'abonnements'
  | 'sorties'
  | 'shopping'
  | 'sante'
  | 'voyages'
  | 'frais'
  | 'proches'
  | 'a-classer'

/** Un « classement » = une catégorie de dépense, ou un type qui n'est pas une dépense. */
export type Classement = CategorieId | Exclude<TypeOperation, 'depense'>

export const CLASSEMENTS: Record<Classement, { label: string; emoji: string }> = {
  logement: { label: 'Logement', emoji: '🏠' },
  courses: { label: 'Courses', emoji: '🛒' },
  restos: { label: 'Restos & cafés', emoji: '🍽️' },
  transport: { label: 'Transport', emoji: '🚇' },
  abonnements: { label: 'Abonnements', emoji: '📱' },
  sorties: { label: 'Sorties & loisirs', emoji: '🎉' },
  shopping: { label: 'Shopping', emoji: '🛍️' },
  sante: { label: 'Santé & beauté', emoji: '💊' },
  voyages: { label: 'Voyages', emoji: '✈️' },
  frais: { label: 'Frais bancaires', emoji: '🏦' },
  proches: { label: 'Virements à des proches', emoji: '💸' },
  'a-classer': { label: 'À classer', emoji: '❓' },
  epargne: { label: 'Épargne', emoji: '🐷' },
  revenu: { label: 'Revenu', emoji: '💰' },
  remboursement: { label: 'Remboursement', emoji: '🤝' },
}

/** Choix proposés selon le sens de l'opération. */
export const CHOIX_DEBIT: Classement[] = [
  'logement', 'courses', 'restos', 'transport', 'abonnements', 'sorties',
  'shopping', 'sante', 'voyages', 'frais', 'proches', 'epargne', 'a-classer',
]
export const CHOIX_CREDIT: Classement[] = ['revenu', 'remboursement']

export function typeDuClassement(c: Classement): TypeOperation {
  return c === 'epargne' || c === 'revenu' || c === 'remboursement' ? c : 'depense'
}

// ---------------------------------------------------------------------------
// 2. Des noms lisibles : "CB HELLOFRESH FR 13/10/26" → "HelloFresh"
// ---------------------------------------------------------------------------

type OpNom = Pick<ReleveOperation, 'libelle' | 'details'>

/** Noms connus, écrits proprement (testés dans l'ordre). */
const NOMS_CONNUS: [RegExp, string][] = [
  [/HELLO ?FRESH/, 'HelloFresh'],
  [/UBER ?EATS/, 'Uber Eats'],
  [/^UBR\*|UBER/, 'Uber'],
  [/AMAZON PRIME|PRIME VIDEO/, 'Amazon Prime'],
  [/AMAZON|AMZN/, 'Amazon'],
  [/GOOGLE ONE/, 'Google One'],
  [/IMAGINE R/, 'Imagine R'],
  [/NAVIGO/, 'Navigo'],
  [/PREDICA|LCL VIE/, 'Assurance vie LCL'],
  [/COTISATION .*CARTE/, 'Cotisation carte'],
  [/ASSURANCE MOYEN DE PAIEMENT/, 'Assurance moyens de paiement'],
  [/FORFAIT LCL/, 'Forfait LCL'],
  [/SNCF/, 'SNCF'],
  [/RATP/, 'RATP'],
  [/^CAF\b/, 'CAF'],
  [/IKEA/, 'Ikea'],
  [/IZLY/, 'Izly (Crous)'],
  [/123 ?BILLETS/, '123billets'],
  [/PRET A MANGER/, 'Pret A Manger'],
  [/SPOTIFY/, 'Spotify'],
  [/NETFLIX/, 'Netflix'],
  [/DEEZER/, 'Deezer'],
  [/APPLE\.COM|ICLOUD/, 'Apple'],
]

const SIGLES = new Set(['LCL', 'SFR', 'CAF', 'EDF', 'SNCF', 'RATP', 'GB', 'FR', 'SAS', 'BNP', 'CPAM', 'H&M'])
const CIVILITES = /^(M\.|MR|MME|MLE|MLLE|MELLE|MADEMOISELLE|MONSIEUR|MADAME)\s+/

function joliMot(mot: string): string {
  if (SIGLES.has(mot.toUpperCase()) || /[.&*]/.test(mot)) return mot.toUpperCase()
  if (/^(DE|DU|DES|LA|LE|LES|ET|D|L)$/i.test(mot)) return mot.toLowerCase()
  // Majuscule à chaque partie d'un nom composé : "HUYBRECHS-TONDREAU" → "Huybrechs-Tondreau"
  return mot
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('-')
}

export function nomMarchand(o: OpNom): string {
  let nom = o.libelle
    .replace(/^(CB|PRLV SEPA|PRLV|VIR INST|VIR SEPA|VIR\.PERMANENT|VIREMENT|VIR)\s+/i, '')
    .replace(/\s+\d{2}\/\d{2}\/\d{2}\s*$/, '') // date en fin de libellé carte
    .trim()
  const haut = nom.toUpperCase()
  for (const [re, joli] of NOMS_CONNUS) if (re.test(haut)) return joli
  nom = nom
    .replace(CIVILITES, '')
    .replace(/\s+-\s+.*$/, '') // "Imagine R - COMUTITRES SAS" → "Imagine R"
    .replace(/(\s+[+*]?\s*\S)$/, (m) => (m.trim().replace(/^[+*]\s*/, '').length <= 1 ? '' : m)) // "BLOOM COFFEE + B"
    .replace(/\s+\d+$/, '') // "SOSTRENE GRENE 4"
    .trim()
  const joli = nom.split(/\s+/).map(joliMot).join(' ')
  return joli ? joli.charAt(0).toUpperCase() + joli.slice(1) : o.libelle
}

/** Clé de commerçant pour les règles : sans accents, en majuscules, + le sens (achat ou rentrée d'argent). */
export function cleRegle(o: OpNom & Pick<ReleveOperation, 'montant'>): string {
  const nom = nomMarchand(o)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
  return `${o.montant < 0 ? '-' : '+'}|${nom}`
}

// ---------------------------------------------------------------------------
// 3. Classement automatique (avant toute correction)
// ---------------------------------------------------------------------------

const MOTS_CLES: [CategorieId, RegExp][] = [
  ['frais', /COTISATION|ASSURANCE MOYEN DE PAIEMENT|FORFAIT LCL|FRAIS |COMMISSION|AGIOS|INTERETS DEBITEURS/],
  ['logement', /LOYER|IMMOBILIER|ENGIE|EDF|TOTALENERGIES|ASSURANCE HABITATION|EAU DE |VEOLIA|SUEZ/],
  ['abonnements', /SFR|ORANGE|BOUYGUES|FREE MOBILE|SOSH|RED BY|GOOGLE ONE|SPOTIFY|NETFLIX|DEEZER|DISNEY|CANAL\+|APPLE\.COM|ICLOUD|AMAZON PRIME|PRIME VIDEO|BASIC.?FIT|FITNESS PARK|YOUTUBE|OPENAI|CHATGPT|ADOBE|CANVA/],
  ['courses', /CARREFOUR|LECLERC|LIDL|ALDI|AUCHAN|MONOPRIX|FRANPRIX|INTERMARCHE|CASINO|PICARD|HELLO ?FRESH|SUPER U|U EXPRESS|BIOCOOP|NATURALIA|GRAND FRAIS|G20|COLRUYT|DAILY MONOP/],
  ['restos', /RESTAU|CAFE|COFFEE|BOULANG|PATISS|PRET A MANGER|MC ?DO|BURGER|KFC|SUSHI|PIZZ|DELIVEROO|UBER ?EATS|IZLY|CROUS|CANTINE|STARBUCKS|BRASSERIE|BISTRO|BAR /],
  ['transport', /IMAGINE R|NAVIGO|RATP|SNCF|TRANSILIEN|^CB UBR\*|UBER|BOLT|LIME|BLABLACAR|TOTAL |ESSO|SHELL|PEAGE|PARKING|INDIGO|TRAINLINE|OUIGO/],
  ['sorties', /123 ?BILLETS|TICKETMASTER|FNAC SPECTACLE|CINEMA|UGC|PATHE|MK2|THEATRE|MUSEE|CONCERT|BOWLING|ESCAPE|SEETICKETS|SHOTGUN|DICE/],
  ['sante', /PHARMA|DOCTOLIB|MEDECIN|DOCTEUR|DENTIST|OPTIC|SEPHORA|NOCIBE|MARIONNAUD|MUTUELLE|LABO|KINE|OSTEO/],
  ['shopping', /AMAZON|AMZN|ZALANDO|ZARA|H ?& ?M|UNIQLO|VINTED|SHEIN|IKEA|SOSTRENE|ACTION |DECATHLON|FNAC|DARTY|KIABI|PRIMARK|MANGO|BERSHKA|PULL ?& ?BEAR|LEROY MERLIN|CULTURA/],
]

export function classementAuto(
  o: Pick<ReleveOperation, 'montant' | 'libelle' | 'details' | 'devise'>,
): Classement {
  const type = typeOperation(o)
  if (type !== 'depense') return type
  const texte = [o.libelle, ...o.details].join(' ').toUpperCase()
  // Frais et logement d'abord, puis : payé en devise étrangère = voyage.
  for (const [cat, re] of MOTS_CLES.slice(0, 2)) if (re.test(texte)) return cat
  if (o.devise) return 'voyages'
  if (/NATURE DU PAIEMENT:\s*MP2P/.test(texte)) return 'proches'
  for (const [cat, re] of MOTS_CLES.slice(2)) if (re.test(texte)) return cat
  return 'a-classer'
}

// ---------------------------------------------------------------------------
// 4. Classement final : correction manuelle > règle de l'utilisatrice > automatique
// ---------------------------------------------------------------------------

export type OpClassable = Pick<ReleveOperation, 'montant' | 'libelle' | 'details' | 'devise'> & {
  categorieManuelle?: Classement
}

/** Une correction n'est valable que si elle respecte le sens (une rentrée d'argent ne peut pas être une dépense). */
function compatible(o: { montant: number }, c: Classement): boolean {
  const t = typeDuClassement(c)
  return o.montant < 0 ? t === 'depense' || t === 'epargne' : t === 'revenu' || t === 'remboursement'
}

export function classer(o: OpClassable, regles: Map<string, Classement>): Classement {
  if (o.categorieManuelle && compatible(o, o.categorieManuelle)) return o.categorieManuelle
  const regle = regles.get(cleRegle(o))
  if (regle && compatible(o, regle)) return regle
  return classementAuto(o)
}
