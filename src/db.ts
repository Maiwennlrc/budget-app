import Dexie, { type EntityTable } from 'dexie'
import type { ReleveOperation } from './lib/lcl/parseReleve.ts'
import type { Classement } from './lib/categories.ts'

// La base de données vit DANS le téléphone (IndexedDB). Rien ne part sur internet.

export interface Transaction extends ReleveOperation {
  /** Identifiant unique : sert à ignorer les doublons si on importe deux fois le même relevé */
  id: string
  importId: number
  /** Catégorie choisie à la main pour CETTE opération (« juste cette fois ») */
  categorieManuelle?: Classement
}

/** « Toujours ranger X dans Y » : une règle par commerçant et par sens (achat / rentrée d'argent). */
export interface Regle {
  /** ex. "-|BLOOM COFFEE" */
  cle: string
  classement: Classement
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

/** Réponse à l'audit d'un abonnement pour un mois donné ("2026-11"). */
export interface AuditMois {
  /** cle + '|' + periode */
  id: string
  cle: string
  periode: string
  statut: 'utilise' | 'inutilise'
}

/** Abonnement résilié : sert au compteur « déjà économisé ». */
export interface Resiliation {
  cle: string
  nom: string
  /** Date de la résiliation (ISO) */
  date: string
  montantMensuel: number
}

export const db = new Dexie('mon-budget') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
  imports: EntityTable<ImportRecord, 'id'>
  regles: EntityTable<Regle, 'cle'>
  audits: EntityTable<AuditMois, 'id'>
  resiliations: EntityTable<Resiliation, 'cle'>
}

// Les champs listés ici sont « indexés » : on peut trier et filtrer dessus rapidement.
db.version(1).stores({
  transactions: 'id, date, importId, idCreancier',
  imports: '++id, periodeFin',
})

// Version 2 : ajout des règles de catégorie. Les données existantes sont conservées.
db.version(2).stores({
  regles: '&cle',
})

// Version 3 : audit mensuel des abonnements et résiliations.
db.version(3).stores({
  audits: '&id, periode',
  resiliations: '&cle',
})
