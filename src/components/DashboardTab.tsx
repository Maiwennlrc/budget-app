import { useState } from 'react'
import { ChevronLeft, ChevronRight, LayoutDashboard, TrendingDown, TrendingUp } from 'lucide-react'
import { formatJourCourt, formatJourLong } from '../lib/dates.ts'
import { formatEuros } from '../lib/money.ts'
import { ajouterJours, bilan, ecartJours } from '../lib/cycles.ts'
import { CLASSEMENTS, type CategorieId } from '../lib/categories.ts'
import { useBudget } from '../hooks/useBudget.ts'

export default function DashboardTab({ allerAuxOperations }: { allerAuxOperations: () => void }) {
  const budget = useBudget()
  const [choix, setChoix] = useState<number | null>(null)

  if (!budget) return null

  if (budget.cycles.length === 0) {
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

  const { operations, imports, cycles, premiere, derniere, parDefaut, classe } = budget
  const index = Math.min(choix ?? parDefaut, cycles.length - 1)
  const cycle = cycles[index]
  const enCours = cycle.fin > derniere
  const b = bilan(operations, cycle.debut, cycle.fin, classe)

  // Comparaison avec le mois de paie précédent, au même nombre de jours.
  const precedent = cycles[index - 1]
  let comparaison: { ecart: number; memeDate: boolean } | null = null
  if (precedent && precedent.debut >= premiere) {
    const fin = enCours
      ? minIso(ajouterJours(precedent.debut, ecartJours(cycle.debut, derniere)), precedent.fin)
      : precedent.fin
    comparaison = { ecart: b.depense - bilan(operations, precedent.debut, fin, classe).depense, memeDate: enCours }
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

      <Repartition parCategorie={b.parCategorie} remboursements={b.remboursements} />

      {dernierImport?.nouveauSolde != null && dernierImport.periodeFin && (
        <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-sm shadow-sm">
          <span className="text-encre-light">Sur ton compte au {formatJourLong(dernierImport.periodeFin)}</span>
          <span className="font-semibold">{formatEuros(dernierImport.nouveauSolde)}</span>
        </div>
      )}

    </div>
  )
}

function Repartition({
  parCategorie,
  remboursements,
}: {
  parCategorie: Partial<Record<CategorieId, number>>
  remboursements: number
}) {
  const lignes = (Object.entries(parCategorie) as [CategorieId, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
  if (lignes.length === 0) return null
  const max = lignes[0][1]
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="mb-3 font-medium">Où est parti ton argent</p>
      <ul className="space-y-3">
        {lignes.map(([cat, v]) => (
          <li key={cat}>
            <div className="flex items-center justify-between text-sm">
              <span>
                {CLASSEMENTS[cat].emoji} {CLASSEMENTS[cat].label}
              </span>
              <span className="font-semibold">{formatEuros(v)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-prune-light">
              <div
                className={`h-2 rounded-full ${cat === 'a-classer' ? 'bg-peche' : 'bg-prune'}`}
                style={{ width: `${Math.max(3, (v / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      {remboursements > 0 && (
        <p className="mt-3 flex justify-between border-t border-prune-light pt-3 text-sm text-emerald-700">
          <span>🤝 Remboursé par tes amis</span>
          <span className="font-semibold">−{formatEuros(remboursements)}</span>
        </p>
      )}
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
