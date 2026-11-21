import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, LayoutDashboard, TrendingDown, TrendingUp } from 'lucide-react'
import { db } from '../db.ts'
import { formatJourCourt, formatJourLong } from '../lib/dates.ts'
import { formatEuros } from '../lib/money.ts'
import { ajouterJours, bilan, construireCycles, ecartJours, jourOperation } from '../lib/cycles.ts'

export default function DashboardTab({ allerAuxOperations }: { allerAuxOperations: () => void }) {
  const operations = useLiveQuery(() => db.transactions.toArray(), [])
  const imports = useLiveQuery(() => db.imports.orderBy('periodeFin').toArray(), [])
  const [choix, setChoix] = useState<number | null>(null)

  const donnees = useMemo(() => {
    if (!operations || !imports || operations.length === 0) return null
    const jours = operations.map(jourOperation).sort()
    const finsReleves = imports.map((i) => i.periodeFin).filter((d): d is string => !!d)
    const derniere = [jours[jours.length - 1], ...finsReleves].sort().at(-1)!
    const premiere = jours[0]
    const cycles = construireCycles(operations, derniere)
    // Par défaut : le dernier mois de paie dont on connaît au moins une semaine.
    let parDefaut = cycles.length - 1
    while (parDefaut > 0 && ecartJours(cycles[parDefaut].debut, derniere) < 7) parDefaut--
    return { cycles, premiere, derniere, parDefaut }
  }, [operations, imports])

  if (!operations || !imports) return null

  if (!donnees) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <LayoutDashboard className="mx-auto mb-3 h-10 w-10 text-prune" />
        <p className="font-medium">Bienvenue dans Mon budget</p>
        <p className="mt-1 text-sm text-encre-light">Pour commencer, importe tes relevés LCL.</p>
        <button onClick={allerAuxOperations} className="mt-4 rounded-xl bg-prune px-4 py-2 text-sm font-medium text-white">
          Importer mes relevés
        </button>
      </div>
    )
  }

  const { cycles, premiere, derniere, parDefaut } = donnees
  const index = Math.min(choix ?? parDefaut, cycles.length - 1)
  const cycle = cycles[index]
  const enCours = cycle.fin > derniere
  const b = bilan(operations, cycle.debut, cycle.fin)

  // Comparaison avec le mois de paie précédent, au même nombre de jours.
  const precedent = cycles[index - 1]
  let comparaison: { ecart: number; memeDate: boolean } | null = null
  if (precedent && precedent.debut >= premiere) {
    const fin = enCours
      ? minIso(ajouterJours(precedent.debut, ecartJours(cycle.debut, derniere)), precedent.fin)
      : precedent.fin
    comparaison = { ecart: b.depense - bilan(operations, precedent.debut, fin).depense, memeDate: enCours }
  }

  const dernierImport = imports.at(-1)

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <button
            aria-label="Mois précédent"
            disabled={index === 0}
            onClick={() => setChoix(index - 1)}
            className="rounded-full p-1 text-prune disabled:opacity-20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-center text-sm text-encre-light">
            {enCours
              ? `Dépensé depuis ta paie du ${formatJourLong(cycle.debut)}`
              : `Dépensé du ${formatJourCourt(cycle.debut)} au ${formatJourCourt(cycle.fin)}`}
          </p>
          <button
            aria-label="Mois suivant"
            disabled={index === cycles.length - 1}
            onClick={() => setChoix(index + 1)}
            className="rounded-full p-1 text-prune disabled:opacity-20"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-center text-4xl font-semibold">{formatEuros(b.depense)}</p>

        {comparaison && comparaison.ecart !== 0 && (
          <p
            className={`mt-2 flex items-center justify-center gap-1 text-sm ${
              comparaison.ecart < 0 ? 'text-emerald-700' : 'text-peche-dark'
            }`}
          >
            {comparaison.ecart < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            {formatEuros(Math.abs(comparaison.ecart))} de {comparaison.ecart < 0 ? 'moins' : 'plus'} que le mois
            précédent{comparaison.memeDate ? ' à la même date' : ''}
          </p>
        )}
        {!comparaison && (
          <p className="mt-2 text-center text-xs text-encre-light">
            Importe le relevé précédent pour comparer avec le mois d'avant
          </p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Mini label="Revenus" valeur={b.revenus} />
          <Mini label="Épargné" valeur={b.epargne} />
          <Mini label="Remboursé par tes amis" valeur={b.remboursements} />
        </div>

        {(enCours || cycle.debut < premiere || cycle.debutEstime) && (
          <p className="mt-3 text-center text-xs text-encre-light">
            {cycle.debut < premiere && `Opérations connues à partir du ${formatJourLong(premiere)}. `}
            {enCours && `Opérations connues jusqu'au ${formatJourLong(derniere)} : importe ton prochain relevé pour compléter. `}
            {cycle.debutEstime && 'Date de paie estimée.'}
          </p>
        )}
      </div>

      {dernierImport?.nouveauSolde != null && dernierImport.periodeFin && (
        <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-sm shadow-sm">
          <span className="text-encre-light">Sur ton compte au {formatJourLong(dernierImport.periodeFin)}</span>
          <span className="font-semibold">{formatEuros(dernierImport.nouveauSolde)}</span>
        </div>
      )}

      <div className="rounded-2xl bg-peche-light p-4 text-sm text-peche-dark">
        Prochaine étape : tes dépenses par catégorie et tes abonnements à passer en revue ✨
      </div>
    </div>
  )
}

function Mini({ label, valeur }: { label: string; valeur: number }) {
  return (
    <div className="rounded-xl bg-creme px-2 py-2">
      <p className="text-sm font-semibold">{formatEuros(valeur).replace(/,00\s?€/, ' €')}</p>
      <p className="text-[11px] leading-tight text-encre-light">{label}</p>
    </div>
  )
}

const minIso = (a: string, b: string) => (a < b ? a : b)
