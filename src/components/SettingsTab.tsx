import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FolderOpen, Save, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react'
import { db } from '../db.ts'
import { META_DERNIERE, META_MDP } from '../lib/sauvegarde.ts'
import { RestaurerSheet, SauvegarderSheet } from './BackupSheets.tsx'

/** "il y a 3 jours", "aujourd'hui"… */
function depuis(iso: string): string {
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (jours <= 0) return "aujourd'hui"
  if (jours === 1) return 'hier'
  return `il y a ${jours} jours`
}

export default function SettingsTab() {
  const [protege, setProtege] = useState<boolean | null>(null)
  const [fiche, setFiche] = useState<'sauver' | 'restaurer' | null>(null)
  const nb = useLiveQuery(() => db.transactions.count(), [])
  const derniere = useLiveQuery(() => db.meta.get(META_DERNIERE), [])
  const mdpMemorise = useLiveQuery(() => db.meta.get(META_MDP), [])

  useEffect(() => {
    navigator.storage?.persisted?.().then(setProtege).catch(() => setProtege(false))
  }, [])

  async function toutEffacer() {
    if (!window.confirm('Effacer toutes tes données de cet appareil ? Pense à sauvegarder avant. Cette action est définitive.'))
      return
    await db.transaction('rw', [db.transactions, db.imports, db.regles, db.audits, db.resiliations, db.meta], async () => {
      await Promise.all([db.transactions.clear(), db.imports.clear(), db.regles.clear(), db.audits.clear(), db.resiliations.clear(), db.meta.clear()])
    })
  }

  return (
    <div className="space-y-4">
      {/* Sauvegarde */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="font-medium">💾 Sauvegarde</p>
        <p className="text-sm text-encre-light">
          {derniere ? `Dernière sauvegarde ${depuis(derniere.valeur)}` : 'Aucune sauvegarde pour le moment'}
          {mdpMemorise && ' · mot de passe mémorisé'}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setFiche('sauver')}
            disabled={!nb}
            className="flex items-center justify-center gap-2 rounded-xl bg-prune px-3 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            <Save className="h-4 w-4" /> Sauvegarder
          </button>
          <button
            onClick={() => setFiche('restaurer')}
            className="flex items-center justify-center gap-2 rounded-xl bg-prune-light px-3 py-3 text-sm font-medium text-prune"
          >
            <FolderOpen className="h-4 w-4" /> Restaurer
          </button>
        </div>
        {mdpMemorise && (
          <button
            onClick={() => void db.meta.delete(META_MDP)}
            className="mt-2 text-xs text-encre-light underline"
          >
            Oublier le mot de passe sur cet appareil
          </button>
        )}
      </div>

      <div className="flex gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
        {protege ? (
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <ShieldAlert className="h-5 w-5 shrink-0 text-peche-dark" />
        )}
        <div>
          <p className="font-medium">Tes données restent sur cet appareil</p>
          <p className="text-encre-light">
            {protege
              ? 'Le navigateur a accepté de les conserver durablement.'
              : "Installe l'app sur ton écran d'accueil pour mieux les protéger, et sauvegarde chaque mois."}
          </p>
        </div>
      </div>

      <button
        onClick={() => void toutEffacer()}
        disabled={!nb}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-prune-light bg-white px-4 py-3 text-sm font-medium text-red-700 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
        Effacer toutes mes données{nb ? ` (${nb} opérations)` : ''}
      </button>

      <p className="text-center text-xs text-encre-light">Mon budget · version du {__VERSION__}</p>

      {fiche === 'sauver' && <SauvegarderSheet onClose={() => setFiche(null)} />}
      {fiche === 'restaurer' && <RestaurerSheet onClose={() => setFiche(null)} />}
    </div>
  )
}
