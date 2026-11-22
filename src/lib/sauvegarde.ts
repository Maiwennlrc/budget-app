import { db, type AuditMois, type ImportRecord, type Regle, type Resiliation, type Transaction } from '../db.ts'

// -----------------------------------------------------------------------------
// Chiffrement : on n'invente rien, on utilise les outils standards du navigateur
// (Web Crypto). Le mot de passe est transformé en clé avec PBKDF2 (600 000 tours,
// pour rendre les essais au hasard très lents), puis les données sont chiffrées
// avec AES-GCM 256 bits, qui détecte aussi toute modification du fichier.
// -----------------------------------------------------------------------------

const ITERATIONS = 600_000
export const MOT_DE_PASSE_MIN = 8

interface FichierSauvegarde {
  format: 'mon-budget'
  version: 1
  kdf: { nom: 'PBKDF2'; hash: 'SHA-256'; iterations: number; sel: string }
  iv: string
  donnees: string
}

export interface ContenuSauvegarde {
  creeLe: string
  transactions: Transaction[]
  imports: ImportRecord[]
  regles: Regle[]
  audits: AuditMois[]
  resiliations: Resiliation[]
}

const versBase64 = (b: ArrayBuffer | Uint8Array) => {
  const octets = b instanceof Uint8Array ? b : new Uint8Array(b)
  let s = ''
  for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000))
  return btoa(s)
}
const depuisBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function cle(motDePasse: string, sel: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sel as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function chiffrer(contenu: ContenuSauvegarde, motDePasse: string): Promise<string> {
  const sel = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const k = await cle(motDePasse, sel, ITERATIONS)
  const clair = new TextEncoder().encode(JSON.stringify(contenu))
  const chiffre = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, k, clair)
  const fichier: FichierSauvegarde = {
    format: 'mon-budget',
    version: 1,
    kdf: { nom: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, sel: versBase64(sel) },
    iv: versBase64(iv),
    donnees: versBase64(chiffre),
  }
  return JSON.stringify(fichier)
}

export class ErreurSauvegarde extends Error {}

export async function dechiffrer(texte: string, motDePasse: string): Promise<ContenuSauvegarde> {
  let fichier: FichierSauvegarde
  try {
    fichier = JSON.parse(texte)
  } catch {
    throw new ErreurSauvegarde("Ce fichier n'est pas une sauvegarde Mon budget.")
  }
  if (fichier?.format !== 'mon-budget') throw new ErreurSauvegarde("Ce fichier n'est pas une sauvegarde Mon budget.")
  const k = await cle(motDePasse, depuisBase64(fichier.kdf.sel), fichier.kdf.iterations)
  try {
    const clair = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: depuisBase64(fichier.iv) as BufferSource },
      k,
      depuisBase64(fichier.donnees) as BufferSource,
    )
    return JSON.parse(new TextDecoder().decode(clair))
  } catch {
    throw new ErreurSauvegarde('Mot de passe incorrect (ou fichier abîmé).')
  }
}

// -----------------------------------------------------------------------------
// Export et restauration (en fusion : on ajoute ce qui manque, sans doublons)
// -----------------------------------------------------------------------------

export async function exporterTout(): Promise<ContenuSauvegarde> {
  const [transactions, imports, regles, audits, resiliations] = await Promise.all([
    db.transactions.toArray(),
    db.imports.toArray(),
    db.regles.toArray(),
    db.audits.toArray(),
    db.resiliations.toArray(),
  ])
  return { creeLe: new Date().toISOString(), transactions, imports, regles, audits, resiliations }
}

export interface BilanRestauration {
  operationsAjoutees: number
  reglesAjoutees: number
}

export async function restaurerEnFusion(c: ContenuSauvegarde): Promise<BilanRestauration> {
  return db.transaction('rw', [db.transactions, db.imports, db.regles, db.audits, db.resiliations], async () => {
    // 1. Relevés importés : on réutilise ceux qui existent déjà (même fichier, même période).
    const locaux = await db.imports.toArray()
    const correspondance = new Map<number, number>()
    for (const imp of c.imports) {
      const existant = locaux.find(
        (l) => l.fichier === imp.fichier && l.periodeDebut === imp.periodeDebut && l.periodeFin === imp.periodeFin,
      )
      if (existant) correspondance.set(imp.id, existant.id)
      else {
        const { id: _ancien, ...sansId } = imp
        correspondance.set(imp.id, (await db.imports.add(sansId)) as number)
      }
    }

    // 2. Opérations : on ajoute celles qui manquent. Si une opération existe déjà sans
    //    correction manuelle et que la sauvegarde en a une, on la récupère.
    const existantes = await db.transactions.bulkGet(c.transactions.map((t) => t.id))
    let operationsAjoutees = 0
    for (let i = 0; i < c.transactions.length; i++) {
      const t = c.transactions[i]
      const local = existantes[i]
      if (!local) {
        await db.transactions.add({ ...t, importId: correspondance.get(t.importId) ?? t.importId })
        operationsAjoutees++
      } else if (!local.categorieManuelle && t.categorieManuelle) {
        await db.transactions.update(t.id, { categorieManuelle: t.categorieManuelle })
      }
    }

    // 3. Règles, réponses d'audit, résiliations : ce qui est sur le téléphone a priorité.
    let reglesAjoutees = 0
    for (const r of c.regles) if (!(await db.regles.get(r.cle))) (await db.regles.add(r), reglesAjoutees++)
    for (const a of c.audits) if (!(await db.audits.get(a.id))) await db.audits.add(a)
    for (const r of c.resiliations) if (!(await db.resiliations.get(r.cle))) await db.resiliations.add(r)

    return { operationsAjoutees, reglesAjoutees }
  })
}

// -----------------------------------------------------------------------------
// Petites infos mémorisées
// -----------------------------------------------------------------------------

export const META_DERNIERE = 'derniereSauvegarde'
export const META_MDP = 'motDePasseMemorise'

export async function lireMeta(cle: string): Promise<string | undefined> {
  return (await db.meta.get(cle))?.valeur
}
export async function ecrireMeta(cle: string, valeur: string | null): Promise<void> {
  if (valeur === null) await db.meta.delete(cle)
  else await db.meta.put({ cle, valeur })
}

/** Nom du fichier : mon-budget-2026-11-22.json */
export const nomFichier = () => `mon-budget-${new Date().toISOString().slice(0, 10)}.json`
