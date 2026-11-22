import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ImportRecord, type Transaction } from '../db.ts'
import { construireCycles, ecartJours, jourOperation, type Cycle } from '../lib/cycles.ts'
import { classer, type Classement } from '../lib/categories.ts'
import { useRegles } from './useRegles.ts'

export interface Budget {
  operations: Transaction[]
  imports: ImportRecord[]
  regles: Map<string, Classement>
  /** Classement final d'une opération (avec les règles de l'utilisatrice) */
  classe: (o: Transaction) => Classement
  /** Mois de paie, du plus ancien au plus récent (vide si aucune opération) */
  cycles: Cycle[]
  /** Premier et dernier jour couverts par les relevés */
  premiere: string
  derniere: string
  /** Mois affiché par défaut : le dernier dont on connaît au moins une semaine */
  parDefaut: number
}

/** Toutes les données calculées dont les écrans ont besoin. `undefined` pendant le chargement. */
export function useBudget(): Budget | undefined {
  const operations = useLiveQuery(() => db.transactions.toArray(), [])
  const imports = useLiveQuery(() => db.imports.orderBy('periodeFin').toArray(), [])
  const regles = useRegles()

  return useMemo(() => {
    if (!operations || !imports || !regles) return undefined
    const classe = (o: Transaction) => classer(o, regles)
    if (operations.length === 0) {
      return { operations, imports, regles, classe, cycles: [], premiere: '', derniere: '', parDefaut: 0 }
    }
    const jours = operations.map(jourOperation).sort()
    const finsReleves = imports.map((i) => i.periodeFin).filter((d): d is string => !!d)
    const derniere = [jours[jours.length - 1], ...finsReleves].sort().at(-1)!
    const premiere = jours[0]
    const cycles = construireCycles(operations, derniere)
    let parDefaut = cycles.length - 1
    while (parDefaut > 0 && ecartJours(cycles[parDefaut].debut, derniere) < 7) parDefaut--
    return { operations, imports, regles, classe, cycles, premiere, derniere, parDefaut }
  }, [operations, imports, regles])
}
