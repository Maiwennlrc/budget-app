import { ExternalLink, X } from 'lucide-react'
import { db, type Transaction } from '../db.ts'
import type { Recurrent } from '../lib/recurrents.ts'
import { guideResiliation } from '../lib/resiliation.ts'
import { formatEuros } from '../lib/money.ts'
import { CLASSEMENTS } from '../lib/categories.ts'

/** Fiche « Résilier X » : s'ouvre quand on marque un abonnement comme inutilisé. */
export default function ResiliationSheet({ abonnement: a, onClose }: { abonnement: Recurrent<Transaction>; onClose: () => void }) {
  const guide = guideResiliation(a.nom, a.classement)

  async function resilie() {
    await db.resiliations.put({
      cle: a.cle,
      nom: a.nom,
      date: new Date().toISOString().slice(0, 10),
      montantMensuel: a.montantMensuel,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-encre/40" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-creme p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <p className="text-lg font-semibold">
            {CLASSEMENTS[a.classement].emoji} Résilier {a.nom}
          </p>
          <button aria-label="Fermer" onClick={onClose} className="rounded-full p-1 text-encre-light">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-emerald-700">
          Tu économiserais {formatEuros(a.montantMensuel)} par mois, soit {formatEuros(a.montantMensuel * 12)} par an 💸
        </p>

        <ol className="mt-4 space-y-2">
          {guide.etapes.map((e, i) => (
            <li key={i} className="flex gap-3 rounded-xl bg-white p-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-prune text-xs font-semibold text-white">
                {i + 1}
              </span>
              {e}
            </li>
          ))}
        </ol>

        {guide.url && (
          <a
            href={guide.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-prune px-4 py-3 font-medium text-white"
          >
            {guide.libelleBouton}
            <ExternalLink className="h-4 w-4" />
          </a>
        )}

        {a.classement !== 'frais' && (
          <p className="mt-3 text-xs text-encre-light">
            💡 Depuis le 1er juin 2023, un abonnement souscrit en ligne doit pouvoir se résilier en ligne, avec un bouton
            « Résilier votre contrat ». Les conditions de ton contrat (engagement, préavis) restent valables.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="rounded-xl border border-prune-light bg-white px-3 py-3 text-sm font-medium">
            Plus tard
          </button>
          <button onClick={() => void resilie()} className="rounded-xl bg-emerald-700 px-3 py-3 text-sm font-medium text-white">
            {a.classement === 'frais' ? "C'est réglé 🎉" : "J'ai résilié 🎉"}
          </button>
        </div>
      </div>
    </div>
  )
}
