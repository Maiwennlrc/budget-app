import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react'
import { db } from '../db.ts'

export default function SettingsTab() {
  const [protege, setProtege] = useState<boolean | null>(null)
  const nb = useLiveQuery(() => db.transactions.count(), [])

  useEffect(() => {
    navigator.storage?.persisted?.().then(setProtege).catch(() => setProtege(false))
  }, [])

  async function toutEffacer() {
    if (!window.confirm('Effacer toutes tes opérations de ce téléphone ? Cette action est définitive.')) return
    await db.transactions.clear()
    await db.imports.clear()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
        {protege ? (
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <ShieldAlert className="h-5 w-5 shrink-0 text-peche-dark" />
        )}
        <div>
          <p className="font-medium">Tes données restent sur ce téléphone</p>
          <p className="text-encre-light">
            {protege
              ? 'Le téléphone a accepté de les conserver durablement.'
              : "Installe l'app sur ton écran d'accueil pour mieux les protéger. Une sauvegarde arrive bientôt."}
          </p>
        </div>
      </div>

      <button
        onClick={toutEffacer}
        disabled={!nb}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-prune-light bg-white px-4 py-3 text-sm font-medium text-red-700 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
        Effacer toutes mes données{nb ? ` (${nb} opérations)` : ''}
      </button>

      <p className="text-center text-xs text-encre-light">Mon budget · version du {__VERSION__}</p>
    </div>
  )
}
