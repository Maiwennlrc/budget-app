import { useState } from 'react'
import { X } from 'lucide-react'
import { db, type Transaction } from '../db.ts'
import {
  CHOIX_CREDIT,
  CHOIX_DEBIT,
  CLASSEMENTS,
  classer,
  cleRegle,
  nomMarchand,
  type Classement,
} from '../lib/categories.ts'
import { formatEuros } from '../lib/money.ts'
import { formatJourLong } from '../lib/dates.ts'
import { jourOperation } from '../lib/cycles.ts'

interface Props {
  operation: Transaction
  toutes: Transaction[]
  regles: Map<string, Classement>
  onClose: () => void
}

/** Fiche d'une opération : détails + choix de catégorie + « Toujours ranger X dans Y ? » */
export default function OperationSheet({ operation: o, toutes, regles, onClose }: Props) {
  const [choisi, setChoisi] = useState<Classement | null>(null)
  const actuel = classer(o, regles)
  const nom = nomMarchand(o)
  const cle = cleRegle(o)
  const autres = toutes.filter((t) => t.id !== o.id && cleRegle(t) === cle).length
  const choix = o.montant < 0 ? CHOIX_DEBIT : CHOIX_CREDIT

  async function choisir(c: Classement) {
    // Si rien d'autre ne vient de ce commerçant, pas besoin de demander : on crée la règle directement.
    if (autres === 0) {
      await toujours(c)
      return
    }
    setChoisi(c)
  }

  async function justeCetteFois(c: Classement) {
    await db.transactions.update(o.id, { categorieManuelle: c })
    onClose()
  }

  async function toujours(c: Classement) {
    await db.transaction('rw', db.regles, db.transactions, async () => {
      await db.regles.put({ cle, classement: c })
      // L'opération suit maintenant la règle : on enlève une éventuelle correction ponctuelle.
      await db.transactions.update(o.id, { categorieManuelle: undefined })
    })
    onClose()
  }

  const details = o.details.filter((d) => !/^(REF\.|ID\.CREANCIER|CREANCIER INITIAL|PAYEUR INITIAL|NATURE DU PAIEMENT)/.test(d))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-encre/40" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-creme p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold">{nom}</p>
            <p className="text-sm text-encre-light">{formatJourLong(jourOperation(o))}</p>
          </div>
          <button aria-label="Fermer" onClick={onClose} className="rounded-full p-1 text-encre-light">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className={`mt-2 text-2xl font-semibold ${o.montant > 0 ? 'text-emerald-700' : ''}`}>
          {o.montant > 0 ? '+' : ''}
          {formatEuros(o.montant)}
        </p>
        <div className="mt-2 rounded-xl bg-white p-3 text-xs text-encre-light">
          <p className="font-medium text-encre">{o.libelle}</p>
          {details.map((d, i) => (
            <p key={i}>{d}</p>
          ))}
        </div>

        {choisi === null ? (
          <>
            <p className="mb-2 mt-4 text-sm font-medium">Catégorie</p>
            <div className="grid grid-cols-3 gap-2">
              {choix.map((c) => (
                <button
                  key={c}
                  onClick={() => void choisir(c)}
                  className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-[11px] leading-tight ${
                    c === actuel ? 'bg-prune text-white' : 'bg-white text-encre'
                  }`}
                >
                  <span className="text-xl">{CLASSEMENTS[c].emoji}</span>
                  {CLASSEMENTS[c].label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-2xl bg-white p-4">
            <p className="font-medium">
              Toujours ranger « {nom} » dans {CLASSEMENTS[choisi].emoji} {CLASSEMENTS[choisi].label} ?
            </p>
            <p className="mt-1 text-sm text-encre-light">
              Ça s'appliquera aussi à {autres} autre{autres > 1 ? 's' : ''} opération{autres > 1 ? 's' : ''} et aux
              prochaines.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => void justeCetteFois(choisi)}
                className="rounded-xl border border-prune-light px-3 py-2 text-sm font-medium"
              >
                Juste cette fois
              </button>
              <button
                onClick={() => void toujours(choisi)}
                className="rounded-xl bg-prune px-3 py-2 text-sm font-medium text-white"
              >
                Oui, toujours
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
