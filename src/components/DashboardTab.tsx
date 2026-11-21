import { useLiveQuery } from 'dexie-react-hooks'
import { LayoutDashboard } from 'lucide-react'
import { db } from '../db.ts'
import { formatJourLong } from '../lib/dates.ts'
import { formatEuros } from '../lib/money.ts'

export default function DashboardTab({ allerAuxOperations }: { allerAuxOperations: () => void }) {
  const nb = useLiveQuery(() => db.transactions.count(), [])
  const dernierImport = useLiveQuery(() => db.imports.orderBy('periodeFin').last(), [])

  if (nb === undefined) return null

  if (nb === 0) {
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

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm text-encre-light">
          Solde au {dernierImport?.periodeFin ? formatJourLong(dernierImport.periodeFin) : 'dernier relevé'}
        </p>
        <p className="text-3xl font-semibold">
          {dernierImport?.nouveauSolde != null ? formatEuros(dernierImport.nouveauSolde) : '—'}
        </p>
        <p className="mt-1 text-sm text-encre-light">{nb} opérations enregistrées</p>
      </div>
      <div className="rounded-2xl bg-peche-light p-4 text-sm text-peche-dark">
        Prochaine étape : tes dépenses par catégorie et tes abonnements à passer en revue ✨
      </div>
    </div>
  )
}
