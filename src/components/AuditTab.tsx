import { useState } from 'react'
import { AlertTriangle, SearchCheck } from 'lucide-react'
import { db, type Transaction } from '../db.ts'
import { useAudit } from '../hooks/useAudit.ts'
import { useBudget } from '../hooks/useBudget.ts'
import { CLASSEMENTS, cleRegle } from '../lib/categories.ts'
import { formatEuros } from '../lib/money.ts'
import { formatJourCourt, formatJourLong } from '../lib/dates.ts'
import { ajouterJours, jourOperation } from '../lib/cycles.ts'
import { moisEcoules, type Recurrent } from '../lib/recurrents.ts'
import ResiliationSheet from './ResiliationSheet.tsx'

const nomDuMois = (periode: string) => new Date(`${periode}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long' })

export default function AuditTab({ allerAuxOperations }: { allerAuxOperations: () => void }) {
  const audit = useAudit()
  const budget = useBudget()
  const [aResilier, setAResilier] = useState<Recurrent<Transaction> | null>(null)

  if (!audit || !budget) return null
  const { periode, abonnements, charges, reponses, resiliations } = audit

  if (budget.operations.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <SearchCheck className="mx-auto mb-3 h-10 w-10 text-prune" />
        <p className="font-medium">Tes abonnements apparaîtront ici</p>
        <p className="mt-1 text-sm text-encre-light">Importe tes relevés pour lancer l'audit.</p>
        <button onClick={allerAuxOperations} className="mt-4 rounded-xl bg-prune px-4 py-2 text-sm font-medium text-white">
          Importer mes relevés
        </button>
      </div>
    )
  }

  async function repondre(a: Recurrent<Transaction>, statut: 'utilise' | 'inutilise') {
    await db.audits.put({ id: `${a.cle}|${periode}`, cle: a.cle, periode, statut })
    if (statut === 'inutilise') setAResilier(a) // on bascule directement vers la résiliation
  }

  const aujourdhui = new Date().toISOString().slice(0, 10)
  const possibles = abonnements.filter((a) => reponses.get(a.cle) === 'inutilise').reduce((s, a) => s + a.montantMensuel * 12, 0)
  const dejaEconomise = resiliations.reduce((s, r) => s + r.montantMensuel * moisEcoules(r.date, aujourdhui), 0)
  const parMoisResilie = resiliations.reduce((s, r) => s + r.montantMensuel, 0)
  const totalAbonnements = abonnements.reduce((s, a) => s + a.montantMensuel, 0)
  const totalCharges = charges.reduce((s, a) => s + a.montantMensuel, 0)

  return (
    <div className="space-y-3">
      {/* Compteurs */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm text-encre-light">Économies possibles</p>
        <p className="text-3xl font-semibold text-emerald-700">{formatEuros(possibles)} / an</p>
        <p className="text-xs text-encre-light">
          {possibles ? 'si tu résilies ce que tu as marqué inutilisé' : "Marque ce que tu n'utilises plus"}
        </p>
        {resiliations.length > 0 && (
          <p className="mt-3 border-t border-prune-light pt-3 text-sm">
            🎉 Déjà économisé : <span className="font-semibold">{formatEuros(dejaEconomise)}</span>
            <span className="block text-xs text-encre-light">
              {formatEuros(parMoisResilie)} de moins chaque mois grâce à tes résiliations
            </span>
          </p>
        )}
      </div>

      {/* Abonnements à auditer */}
      <p className="px-1 text-sm font-semibold text-encre-light">
        📱 Abonnements · {formatEuros(totalAbonnements)}/mois · revue de {nomDuMois(periode)}
      </p>
      {abonnements.length === 0 && (
        <p className="rounded-2xl bg-white p-4 text-sm text-encre-light shadow-sm">Aucun abonnement repéré pour l'instant 👌</p>
      )}
      {abonnements.map((a) => {
        const statut = reponses.get(a.cle)
        return (
          <div
            key={a.cle}
            className={`rounded-2xl p-4 shadow-sm ${statut === 'inutilise' ? 'bg-peche-light' : 'bg-white'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {CLASSEMENTS[a.classement].emoji} {a.nom}
                </p>
                <p className="text-xs text-encre-light">
                  Dernier prélèvement le {formatJourCourt(a.derniereDate)} · ≈ {formatEuros(a.montantMensuel * 12)}/an
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold">{formatEuros(a.montantMensuel)}/mois</p>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void repondre(a, 'utilise')}
                className={`flex-1 rounded-xl py-2 text-sm font-medium ${
                  statut === 'utilise' ? 'bg-prune text-white' : 'bg-prune-light text-prune'
                }`}
              >
                ✅ Utilisé
              </button>
              <button
                onClick={() => void repondre(a, 'inutilise')}
                className={`flex-1 rounded-xl py-2 text-sm font-medium ${
                  statut === 'inutilise' ? 'bg-peche-dark text-white' : 'bg-peche-light text-peche-dark'
                }`}
              >
                ❌ Inutilisé
              </button>
            </div>
            {statut === 'inutilise' && (
              <button
                onClick={() => setAResilier(a)}
                className="mt-2 w-full rounded-xl bg-white py-2 text-sm font-medium text-peche-dark"
              >
                Comment résilier ? →
              </button>
            )}
          </div>
        )
      })}

      {/* Résiliés */}
      {resiliations.length > 0 && (
        <>
          <p className="px-1 pt-2 text-sm font-semibold text-encre-light">🎉 Résiliés</p>
          <ul className="space-y-2">
            {resiliations.map((r) => {
              // Encore prélevé plus de 5 jours après la résiliation ? On prévient.
              const encore = budget.operations
                .filter((o) => o.montant < 0 && jourOperation(o) > ajouterJours(r.date, 5))
                .find((o) => cleRegle(o) === r.cle)
              return (
                <li key={r.cle} className="rounded-2xl bg-white p-4 text-sm shadow-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{r.nom}</span>
                    <span className="font-semibold text-emerald-700">+{formatEuros(r.montantMensuel)}/mois</span>
                  </div>
                  <p className="text-xs text-encre-light">Résilié le {formatJourLong(r.date)}</p>
                  {encore && (
                    <p className="mt-2 flex gap-1 rounded-xl bg-peche-light p-2 text-xs text-peche-dark">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Encore prélevé le {formatJourCourt(jourOperation(encore))} : vérifie que ta résiliation a bien été prise
                      en compte.
                    </p>
                  )}
                  <button
                    onClick={() => void db.resiliations.delete(r.cle)}
                    className="mt-2 text-xs text-encre-light underline"
                  >
                    Annuler (je ne l'ai pas résilié)
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* Charges fixes */}
      {charges.length > 0 && (
        <>
          <p className="px-1 pt-2 text-sm font-semibold text-encre-light">
            🏠 Charges fixes · {formatEuros(totalCharges)}/mois · pour info
          </p>
          <ul className="divide-y divide-prune-light rounded-2xl bg-white px-4 shadow-sm">
            {charges.map((c) => (
              <li key={c.cle} className="flex justify-between py-3 text-sm">
                <span>
                  {CLASSEMENTS[c.classement].emoji} {c.nom}
                </span>
                <span className="font-semibold">{formatEuros(c.montantMensuel)}/mois</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="px-1 text-xs text-encre-light">
        L'app repère les dépenses qui reviennent chaque mois. Un abonnement manque ? Classe-le dans 📱 Abonnements depuis
        l'onglet Opérations.
      </p>

      {aResilier && <ResiliationSheet abonnement={aResilier} onClose={() => setAResilier(null)} />}
    </div>
  )
}
