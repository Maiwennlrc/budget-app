import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Eye, EyeOff, Loader2, X } from 'lucide-react'
import {
  chiffrer,
  dechiffrer,
  ecrireMeta,
  ErreurSauvegarde,
  exporterTout,
  lireMeta,
  META_DERNIERE,
  META_MDP,
  MOT_DE_PASSE_MIN,
  nomFichier,
  restaurerEnFusion,
} from '../lib/sauvegarde.ts'

function Fiche({ titre, onClose, children }: { titre: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-encre/40" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-creme p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <p className="text-lg font-semibold">{titre}</p>
          <button type="button" aria-label="Fermer" onClick={onClose} className="rounded-full p-1 text-encre-light">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Champ mot de passe compatible avec le trousseau iCloud / le gestionnaire de mots de passe. */
function ChampMotDePasse({
  valeur,
  onChange,
  nouveau,
}: {
  valeur: string
  onChange: (v: string) => void
  nouveau: boolean
}) {
  const [voir, setVoir] = useState(false)
  return (
    <>
      {/* Identifiant invisible : permet au trousseau de ranger le mot de passe sous « Mon budget ». */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        value="Sauvegarde Mon budget"
        readOnly
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
      <label className="block text-sm font-medium" htmlFor="mdp">
        Mot de passe de la sauvegarde
      </label>
      <div className="mt-1 flex items-center rounded-xl border border-prune-light bg-white pr-2">
        <input
          id="mdp"
          name="password"
          type={voir ? 'text' : 'password'}
          autoComplete={nouveau ? 'new-password' : 'current-password'}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl px-3 py-3 text-base outline-none"
          placeholder={`${MOT_DE_PASSE_MIN} caractères minimum`}
        />
        <button
          type="button"
          onClick={() => setVoir(!voir)}
          aria-label={voir ? 'Masquer' : 'Afficher'}
          className="p-1 text-encre-light"
        >
          {voir ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </>
  )
}

function CaseSeSouvenir({ coche, onChange }: { coche: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-3 flex items-start gap-2 text-sm">
      <input type="checkbox" checked={coche} onChange={(e) => onChange(e.target.checked)} className="mt-1 accent-prune" />
      <span>
        Se souvenir du mot de passe sur cet appareil
        <span className="block text-xs text-encre-light">Pour ne pas le retaper à chaque sauvegarde.</span>
      </span>
    </label>
  )
}

/** Partage vers « Fichiers » sur téléphone, téléchargement classique sur ordinateur. */
async function enregistrerFichier(contenu: string) {
  const fichier = new File([contenu], nomFichier(), { type: 'application/json' })
  const tactile = window.matchMedia('(pointer: coarse)').matches
  if (tactile && navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: 'Sauvegarde Mon budget' })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
    }
  }
  const url = URL.createObjectURL(fichier)
  const a = document.createElement('a')
  a.href = url
  a.download = fichier.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function SauvegarderSheet({ onClose }: { onClose: () => void }) {
  const [mdp, setMdp] = useState('')
  const [seSouvenir, setSeSouvenir] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')
  const [fini, setFini] = useState(false)

  useEffect(() => {
    void lireMeta(META_MDP).then((m) => {
      if (m) {
        setMdp(m)
        setSeSouvenir(true)
      }
    })
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mdp.length < MOT_DE_PASSE_MIN) {
      setErreur(`Choisis un mot de passe d'au moins ${MOT_DE_PASSE_MIN} caractères.`)
      return
    }
    setErreur('')
    setEnCours(true)
    try {
      const contenu = await chiffrer(await exporterTout(), mdp)
      await enregistrerFichier(contenu)
      await ecrireMeta(META_DERNIERE, new Date().toISOString())
      await ecrireMeta(META_MDP, seSouvenir ? mdp : null)
      setFini(true)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErreur("La sauvegarde n'a pas pu être créée. Réessaie.")
    } finally {
      setEnCours(false)
    }
  }

  if (fini) {
    return (
      <Fiche titre="💾 Sauvegarde créée" onClose={onClose}>
        <p className="text-sm">
          Ton fichier <span className="font-medium">{nomFichier()}</span> est prêt. Range-le en lieu sûr : iCloud Drive,
          Google Drive, ou envoie-le-toi par mail.
        </p>
        <p className="mt-2 text-sm text-encre-light">Il est chiffré : sans ton mot de passe, personne ne peut le lire.</p>
        <button onClick={onClose} className="mt-4 w-full rounded-xl bg-prune py-3 font-medium text-white">
          Super, merci !
        </button>
      </Fiche>
    )
  }

  return (
    <Fiche titre="💾 Sauvegarder mes données" onClose={onClose}>
      <form onSubmit={(e) => void onSubmit(e)}>
        <p className="mb-3 text-sm text-encre-light">
          Toutes tes opérations, règles et réponses d'audit sont rangées dans un fichier protégé par un mot de passe.
        </p>
        <ChampMotDePasse valeur={mdp} onChange={(v) => (setMdp(v), setErreur(''))} nouveau />
        <CaseSeSouvenir coche={seSouvenir} onChange={setSeSouvenir} />
        <p className="mt-3 rounded-xl bg-peche-light p-3 text-xs text-peche-dark">
          ⚠️ Si tu oublies ce mot de passe, la sauvegarde ne pourra plus jamais être ouverte, par personne. Accepte de
          l'enregistrer dans le trousseau de ton téléphone quand il te le propose.
        </p>
        {erreur && <p className="mt-2 text-sm text-red-700">{erreur}</p>}
        <button
          type="submit"
          disabled={enCours}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-prune py-3 font-medium text-white disabled:opacity-60"
        >
          {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
          Créer la sauvegarde
        </button>
      </form>
    </Fiche>
  )
}

export function RestaurerSheet({ onClose }: { onClose: () => void }) {
  const [fichier, setFichier] = useState<File | null>(null)
  const [mdp, setMdp] = useState('')
  const [seSouvenir, setSeSouvenir] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')
  const [bilan, setBilan] = useState<{ operationsAjoutees: number; reglesAjoutees: number } | null>(null)

  useEffect(() => {
    void lireMeta(META_MDP).then((m) => m && (setMdp(m), setSeSouvenir(true)))
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!fichier) return setErreur('Choisis d’abord ton fichier de sauvegarde.')
    if (!mdp) return setErreur('Tape le mot de passe de la sauvegarde.')
    setErreur('')
    setEnCours(true)
    try {
      const contenu = await dechiffrer(await fichier.text(), mdp)
      setBilan(await restaurerEnFusion(contenu))
      await ecrireMeta(META_MDP, seSouvenir ? mdp : null)
    } catch (e) {
      setErreur(e instanceof ErreurSauvegarde ? e.message : 'La restauration a échoué. Réessaie.')
    } finally {
      setEnCours(false)
    }
  }

  if (bilan) {
    return (
      <Fiche titre="✅ Données restaurées" onClose={onClose}>
        <p className="text-sm">
          {bilan.operationsAjoutees === 0
            ? 'Tout était déjà là : aucune opération manquante 👌'
            : `${bilan.operationsAjoutees} opération${bilan.operationsAjoutees > 1 ? 's' : ''} récupérée${bilan.operationsAjoutees > 1 ? 's' : ''}${
                bilan.reglesAjoutees > 0 ? `, ${bilan.reglesAjoutees} règle${bilan.reglesAjoutees > 1 ? 's' : ''} de catégorie` : ''
              }.`}
        </p>
        <p className="mt-2 text-sm text-encre-light">Ce qui était déjà sur cet appareil a été conservé.</p>
        <button onClick={onClose} className="mt-4 w-full rounded-xl bg-prune py-3 font-medium text-white">
          Parfait
        </button>
      </Fiche>
    )
  }

  return (
    <Fiche titre="📂 Restaurer une sauvegarde" onClose={onClose}>
      <form onSubmit={(e) => void onSubmit(e)}>
        <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-dashed border-prune bg-white px-4 py-3 text-sm">
          <span className="truncate">{fichier ? fichier.name : 'Choisir mon fichier mon-budget-….json'}</span>
          <span className="shrink-0 font-medium text-prune">Parcourir</span>
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="mt-3">
          <ChampMotDePasse valeur={mdp} onChange={(v) => (setMdp(v), setErreur(''))} nouveau={false} />
        </div>
        <CaseSeSouvenir coche={seSouvenir} onChange={setSeSouvenir} />
        <p className="mt-3 text-xs text-encre-light">
          Les données de la sauvegarde sont ajoutées à celles déjà présentes, sans doublons et sans rien effacer.
        </p>
        {erreur && <p className="mt-2 text-sm text-red-700">{erreur}</p>}
        <button
          type="submit"
          disabled={enCours}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-prune py-3 font-medium text-white disabled:opacity-60"
        >
          {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
          Restaurer
        </button>
      </form>
    </Fiche>
  )
}
