import Dexie, { type EntityTable } from 'dexie'
import type { ReleveOperation } from './lib/lcl/parseReleve.ts'

// La base de données vit DANS le téléphone (IndexedDB). Rien ne part sur internet.

export interface Transaction extends ReleveOperation {
  /** Identifiant unique : sert à ignorer les doublons si on importe deux fois le même relevé */
  id: string
  importId: number
}

export interface ImportRecord {
  id: number
  fichier: string
  periodeDebut: string | null
  periodeFin: string | null
  nbOperations: number
  nbNouvelles: number
  soldeVerifie: boolean
  ecart: number | null
  nouveauSolde: number | null
  dateImport: string
}

export const db = new Dexie('mon-budget') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
  imports: EntityTable<ImportRecord, 'id'>
}

// Les champs listés ici sont « indexés » : on peut trier et filtrer dessus rapidement.
db.version(1).stores({
  transactions: 'id, date, importId, idCreancier',
  imports: '++id, periodeFin',
})
