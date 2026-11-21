import { db, type Transaction } from '../db.ts'
import { parseReleveLcl, type ReleveOperation } from './lcl/parseReleve.ts'
import { extractPdfText } from './pdf/extractText.ts'

export type ImportResult =
  | {
      ok: true
      fichier: string
      periodeDebut: string | null
      periodeFin: string | null
      nbOperations: number
      nbNouvelles: number
      soldeVerifie: boolean
      ecart: number | null
    }
  | { ok: false; fichier: string; erreur: string }

/**
 * Identifiant stable d'une opération : date + montant + libellé + numéro d'occurrence.
 * Le numéro d'occurrence permet de garder deux opérations identiques le même jour
 * (deux cafés à 2,50 €) tout en ignorant un relevé importé deux fois.
 */
function buildIds(operations: ReleveOperation[]): string[] {
  const seen = new Map<string, number>()
  return operations.map((o) => {
    const base = `${o.date}|${o.montant}|${o.libelle}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return `${base}|${n}`
  })
}

export async function importReleve(file: File): Promise<ImportResult> {
  try {
    const releve = parseReleveLcl(await extractPdfText(file))
    if (releve.operations.length === 0) {
      return { ok: false, fichier: file.name, erreur: "Ce fichier ne ressemble pas à un relevé de compte LCL." }
    }

    const ids = buildIds(releve.operations)
    return await db.transaction('rw', db.transactions, db.imports, async () => {
      const existing = await db.transactions.bulkGet(ids)
      const importId = await db.imports.add({
        fichier: file.name,
        periodeDebut: releve.periodeDebut,
        periodeFin: releve.periodeFin,
        nbOperations: releve.operations.length,
        nbNouvelles: 0,
        soldeVerifie: releve.soldeVerifie,
        ecart: releve.ecart,
        nouveauSolde: releve.nouveauSolde,
        dateImport: new Date().toISOString(),
      })

      const nouvelles: Transaction[] = releve.operations
        .map((o, i) => ({ ...o, id: ids[i], importId: importId as number }))
        .filter((_, i) => existing[i] === undefined)

      await db.transactions.bulkAdd(nouvelles)
      await db.imports.update(importId as number, { nbNouvelles: nouvelles.length })

      return {
        ok: true as const,
        fichier: file.name,
        periodeDebut: releve.periodeDebut,
        periodeFin: releve.periodeFin,
        nbOperations: releve.operations.length,
        nbNouvelles: nouvelles.length,
        soldeVerifie: releve.soldeVerifie,
        ecart: releve.ecart,
      }
    })
  } catch (e) {
    console.error(e)
    return { ok: false, fichier: file.name, erreur: "Impossible de lire ce fichier. Est-ce bien un PDF ?" }
  }
}
