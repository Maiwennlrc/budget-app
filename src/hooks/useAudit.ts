import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type AuditMois, type Resiliation, type Transaction } from '../db.ts'
import { detecterRecurrents, type Recurrent } from '../lib/recurrents.ts'
import { useBudget } from './useBudget.ts'

/** Le mois de l'audit en cours : le mois calendaire d'aujourd'hui, ex. "2026-11". */
export function periodeActuelle(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface Audit {
  periode: string
  abonnements: Recurrent<Transaction>[]
  charges: Recurrent<Transaction>[]
  /** Réponses du mois en cours, par clé d'abonnement */
  reponses: Map<string, AuditMois['statut']>
  resiliations: Resiliation[]
  /** Abonnements sans réponse ce mois-ci (hors résiliés) */
  aRevoir: number
}

export function useAudit(): Audit | undefined {
  const budget = useBudget()
  const periode = periodeActuelle()
  const audits = useLiveQuery(() => db.audits.where('periode').equals(periode).toArray(), [periode])
  const resiliations = useLiveQuery(() => db.resiliations.toArray(), [])

  return useMemo(() => {
    if (!budget || !audits || !resiliations) return undefined
    const recurrents = budget.derniere ? detecterRecurrents(budget.operations, budget.classe, budget.derniere) : []
    const resilies = new Set(resiliations.map((r) => r.cle))
    const abonnements = recurrents.filter((r) => r.section === 'abonnement' && !resilies.has(r.cle))
    const charges = recurrents.filter((r) => r.section === 'charge')
    const reponses = new Map(audits.map((a) => [a.cle, a.statut]))
    const aRevoir = abonnements.filter((r) => !reponses.has(r.cle)).length
    return { periode, abonnements, charges, reponses, resiliations, aRevoir }
  }, [budget, audits, resiliations, periode])
}
