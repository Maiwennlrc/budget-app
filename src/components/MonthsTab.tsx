import { useEffect, useRef, useState } from 'react'
import { BarChart3, Sparkles } from 'lucide-react'
import { useBudget } from '../hooks/useBudget.ts'
import { ajouterJours, bilan, jourOperation, type Cycle } from '../lib/cycles.ts'
import { CLASSEMENTS, cleRegle, nomMarchand, type CategorieId } from '../lib/categories.ts'
import { formatEuros } from '../lib/money.ts'
import { formatJourCourt } from '../lib/dates.ts'
import type { Transaction } from '../db.ts'

/** Le mois « principal » d'un mois de paie : celui où tombe son 15e jour (29 sept. → 28 oct. = octobre). */
function moisPrincipal(c: Cycle): Date {
  return new Date(`${ajouterJours(c.debut, 15)}T12:00:00`)
}
const moisCourt = (c: Cycle) => moisPrincipal(c).toLocaleDateString('fr-FR', { month: 'short' })
function titreMois(c: Cycle): string {
  const nom = moisPrincipal(c).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return `Mois de paie ${/^[aeiouy]/i.test(nom) ? "d'" : 'de '}${nom}`
}
/** "1 865,36 €" → "1 865 €" pour les petits encarts */
const arrondi = (c: number) => formatEuros(Math.round(c / 100) * 100).replace(/,00\s?€/, ' €')

export default function MonthsTab({ allerAuxOperations }: { allerAuxOperations: () => void }) {
  const budget = useBudget()
  const [choix, setChoix] = useState<number | null>(null)
  const defilement = useRef<HTMLDivElement>(null)

  // Au premier affichage, on fait défiler le graphique jusqu'aux mois les plus récents.
  useEffect(() => {
    const el = defilement.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [budget?.cycles.length])

  if (!budget) return null
  const { operations, cycles, premiere, derniere, parDefaut, classe } = budget

  if (cycles.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <BarChart3 className="mx-auto mb-3 h-10 w-10 text-prune" />
        <p className="font-medium">Tes mois apparaîtront ici</p>
        <p className="mt-1 text-sm text-encre-light">Importe tes relevés pour voir l'historique.</p>
        <button onClick={allerAuxOperations} className="mt-4 rounded-xl bg-prune px-4 py-2 text-sm font-medium text-white">
          Importer mes relevés
        </button>
      </div>
    )
  }

  const bilans = cycles.map((c) => bilan(operations, c.debut, c.fin, classe))
  const complet = (c: Cycle) => c.debut >= premiere && c.fin <= derniere
  const complets = bilans.filter((_, i) => complet(cycles[i]))
  const moyenne = complets.length ? complets.reduce((s, b) => s + b.depense, 0) / complets.length : null
  const max = Math.max(1, ...bilans.flatMap((b) => [b.depense, b.revenus]))
  const HAUTEUR = 140

  const index = Math.min(choix ?? parDefaut, cycles.length - 1)
  const cycle = cycles[index]
  const b = bilans[index]
  const bilanDuMois = b.revenus - b.depense - b.epargne
  const topCategories = (Object.entries(b.parCategorie) as [CategorieId, number][])
    .filter(([, v]) => v > 0)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3)

  return (
    <div className="space-y-3">
      {/* Graphique : une paire de barres par mois de paie */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-4 text-xs text-encre-light">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-prune" /> Dépensé
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-peche" /> Revenus
          </span>
          {moyenne !== null && <span className="ml-auto">Moyenne dépensée : {arrondi(moyenne)}</span>}
        </div>

        <div ref={defilement} className="overflow-x-auto">
          <div className="relative flex min-w-full items-end gap-1" style={{ height: HAUTEUR + 24 }}>
            {moyenne !== null && (
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-encre-light/50"
                style={{ bottom: 24 + (moyenne / max) * HAUTEUR }}
              />
            )}
            {cycles.map((c, i) => {
              const actif = i === index
              const partiel = !complet(c)
              return (
                <button
                  key={c.debut}
                  onClick={() => setChoix(i)}
                  aria-label={`${titreMois(c)} : ${formatEuros(bilans[i].depense)} dépensés`}
                  className={`flex min-w-[48px] flex-1 flex-col items-center justify-end rounded-xl px-1 pt-2 ${
                    actif ? 'bg-prune-light' : ''
                  }`}
                  style={{ height: HAUTEUR + 24 }}
                >
                  <span className={`flex items-end gap-0.5 ${partiel ? 'opacity-40' : ''}`}>
                    <span
                      className="w-3.5 rounded-t bg-prune"
                      style={{ height: Math.max(2, (bilans[i].depense / max) * HAUTEUR) }}
                    />
                    <span
                      className="w-3.5 rounded-t bg-peche"
                      style={{ height: Math.max(2, (bilans[i].revenus / max) * HAUTEUR) }}
                    />
                  </span>
                  <span className={`mt-1 h-5 text-[11px] ${actif ? 'font-semibold text-prune' : 'text-encre-light'}`}>
                    {moisCourt(c)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        {cycles.some((c) => !complet(c)) && (
          <p className="mt-2 text-[11px] text-encre-light">Les barres pâles sont des mois incomplets (relevé manquant).</p>
        )}
      </div>

      {/* Récap du mois choisi */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-medium first-letter:uppercase">{titreMois(cycle)}</p>
        <p className="text-xs text-encre-light">
          Du {formatJourCourt(cycle.debut)} au {formatJourCourt(cycle.fin)}
          {!complet(cycle) && ' · mois incomplet'}
        </p>

        <p className="mt-3 text-3xl font-semibold">{formatEuros(b.depense)}</p>
        <p className="text-sm text-encre-light">dépensés</p>
        {moyenne !== null && complet(cycle) && complets.length > 1 && Math.abs(b.depense - moyenne) >= 100 && (
          <p className={`mt-1 text-sm ${b.depense < moyenne ? 'text-emerald-700' : 'text-peche-dark'}`}>
            {b.depense < moyenne ? '▼' : '▲'} {arrondi(Math.abs(b.depense - moyenne))} de{' '}
            {b.depense < moyenne ? 'moins' : 'plus'} que ta moyenne
          </p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Encart label="Revenus" valeur={arrondi(b.revenus)} />
          <Encart label="Épargné" valeur={arrondi(b.epargne)} />
          <Encart
            label="Bilan du mois"
            valeur={`${bilanDuMois >= 0 ? '+' : '−'}${arrondi(Math.abs(bilanDuMois))}`}
            couleur={bilanDuMois >= 0 ? 'text-emerald-700' : 'text-peche-dark'}
          />
        </div>
        <p className="mt-2 text-[11px] text-encre-light">
          Bilan = revenus − dépenses − épargne. En vert, tu as gardé de l'argent ce mois-ci ; en orange, tu as puisé dans
          tes réserves.
        </p>

        {topCategories.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-sm font-medium">Top catégories</p>
            <ul className="space-y-1 text-sm">
              {topCategories.map(([cat, v]) => (
                <li key={cat} className="flex justify-between">
                  <span>
                    {CLASSEMENTS[cat].emoji} {CLASSEMENTS[cat].label}
                  </span>
                  <span className="font-semibold">{formatEuros(v)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Nouveautes operations={operations} cycle={cycle} premiere={premiere} classe={budget.classe} />
    </div>
  )
}

function Encart({ label, valeur, couleur = '' }: { label: string; valeur: string; couleur?: string }) {
  return (
    <div className="rounded-xl bg-creme px-2 py-2">
      <p className={`text-sm font-semibold ${couleur}`}>{valeur}</p>
      <p className="text-[11px] leading-tight text-encre-light">{label}</p>
    </div>
  )
}

/**
 * Nouveautés : prélèvements et abonnements qui apparaissent pour la première fois ce mois-ci.
 * (Un nouveau café n'est pas une nouveauté ; un nouveau prélèvement, si.)
 */
function Nouveautes({
  operations,
  cycle,
  premiere,
  classe,
}: {
  operations: Transaction[]
  cycle: Cycle
  premiere: string
  classe: (o: Transaction) => string
}) {
  const estSuivi = (o: Transaction) => o.montant < 0 && (/^PRLV/.test(o.libelle) || classe(o) === 'abonnements')

  if (cycle.debut <= premiere) {
    return (
      <div className="rounded-2xl bg-peche-light p-4 text-sm text-peche-dark">
        <Sparkles className="mr-1 inline h-4 w-4" />
        Importe le relevé du mois précédent pour repérer les nouveaux prélèvements de ce mois-ci.
      </div>
    )
  }

  const dejaVus = new Set(operations.filter((o) => jourOperation(o) < cycle.debut).map(cleRegle))
  const nouveaux = new Map<string, Transaction>()
  for (const o of operations) {
    const j = jourOperation(o)
    if (j < cycle.debut || j > cycle.fin || !estSuivi(o)) continue
    const cle = cleRegle(o)
    if (!dejaVus.has(cle) && !nouveaux.has(cle)) nouveaux.set(cle, o)
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="flex items-center gap-1 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-peche" /> Nouveautés du mois
      </p>
      {nouveaux.size === 0 ? (
        <p className="mt-1 text-sm text-encre-light">Aucun nouveau prélèvement ni abonnement ce mois-ci 👌</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {[...nouveaux.values()].map((o) => (
            <li key={o.id} className="flex items-center justify-between rounded-xl bg-peche-light px-3 py-2">
              <span>
                <span className="font-medium">{nomMarchand(o)}</span>
                <span className="block text-xs text-peche-dark">Premier prélèvement le {formatJourCourt(jourOperation(o))}</span>
              </span>
              <span className="font-semibold">{formatEuros(o.montant)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
