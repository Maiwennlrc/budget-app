import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, FileUp, Loader2 } from 'lucide-react'
import { importReleve, type ImportResult } from '../lib/importReleves.ts'
import { ecrireMeta } from '../lib/sauvegarde.ts'
import {
  detecterAppareil,
  estInstallee,
  installationDirectePossible,
  installerDirectement,
  surChangementInstallation,
} from '../lib/installation.ts'
import { SauvegarderSheet } from './BackupSheets.tsx'

export const META_PRENOM = 'prenom'
export const META_GUIDE = 'guideTermine'

const NB_ETAPES = 4

/** Guide de premier lancement : 4 écrans, qu'on peut passer à tout moment. */
export default function Onboarding({ prenomActuel, onFin }: { prenomActuel: string; onFin: () => void }) {
  const [etape, setEtape] = useState(0)
  const [prenom, setPrenom] = useState(prenomActuel)

  async function terminer() {
    await ecrireMeta(META_GUIDE, new Date().toISOString())
    onFin()
  }
  async function suivant() {
    if (etape === 0) await ecrireMeta(META_PRENOM, prenom.trim() || null)
    if (etape === NB_ETAPES - 1) await terminer()
    else setEtape(etape + 1)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-center bg-prune-light">
      <div className="flex h-full w-full max-w-md flex-col bg-creme">
        <div className="flex items-center justify-between px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex gap-1.5" aria-label={`Étape ${etape + 1} sur ${NB_ETAPES}`}>
            {Array.from({ length: NB_ETAPES }, (_, i) => (
              <span key={i} className={`h-2 rounded-full transition-all ${i === etape ? 'w-6 bg-prune' : 'w-2 bg-prune/25'}`} />
            ))}
          </div>
          <button onClick={() => void terminer()} className="text-sm text-encre-light">
            Passer
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {etape === 0 && <Bienvenue prenom={prenom} setPrenom={setPrenom} />}
          {etape === 1 && <Releves />}
          {etape === 2 && <Importer />}
          {etape === 3 && <Installer prenom={prenom} />}
        </div>

        <div className="flex gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          {etape > 0 && (
            <button onClick={() => setEtape(etape - 1)} className="rounded-2xl border border-prune-light bg-white px-5 py-3 font-medium">
              Retour
            </button>
          )}
          <button onClick={() => void suivant()} className="flex-1 rounded-2xl bg-prune py-3 font-medium text-white">
            {etape === 0 ? "C'est parti !" : etape === NB_ETAPES - 1 ? 'Terminer 🎉' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Titre({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <>
      <p className="text-5xl">{emoji}</p>
      <h2 className="mt-3 text-2xl font-semibold">{children}</h2>
    </>
  )
}

function Etapes({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-4 space-y-2">
      {items.map((e, i) => (
        <li key={i} className="flex gap-3 rounded-xl bg-white p-3 text-sm">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-prune text-xs font-semibold text-white">
            {i + 1}
          </span>
          <span>{e}</span>
        </li>
      ))}
    </ol>
  )
}

function Bienvenue({ prenom, setPrenom }: { prenom: string; setPrenom: (p: string) => void }) {
  return (
    <div>
      <Titre emoji="💜">Bienvenue dans Mon budget</Titre>
      <p className="mt-3 text-encre-light">
        Chaque semaine, vois en un coup d'œil où part ton argent. Chaque mois, repère les abonnements que tu paies pour
        rien.
      </p>
      <p className="mt-3 rounded-xl bg-white p-3 text-sm">
        🔒 Tes données restent <span className="font-medium">uniquement sur ton téléphone</span>. Rien n'est envoyé sur
        internet, personne d'autre ne peut les voir.
      </p>
      <label htmlFor="prenom" className="mt-6 block font-medium">
        Comment tu t'appelles ?
      </label>
      <input
        id="prenom"
        value={prenom}
        onChange={(e) => setPrenom(e.target.value)}
        autoComplete="given-name"
        placeholder="Ton prénom"
        className="mt-2 w-full rounded-xl border border-prune-light bg-white px-3 py-3 text-base outline-none focus:border-prune"
      />
    </div>
  )
}

function Releves() {
  return (
    <div>
      <Titre emoji="📄">Récupère tes relevés LCL</Titre>
      <p className="mt-3 text-encre-light">L'app lit les relevés de compte que LCL te donne chaque mois, en PDF.</p>
      <Etapes
        items={[
          <>Connecte-toi sur <span className="font-medium">LCL.fr</span></>,
          <>Ouvre le menu <span className="font-medium">Documents</span>, puis <span className="font-medium">Relevés de compte de dépôt</span></>,
          <>Télécharge tes relevés des <span className="font-medium">derniers mois</span> (6 mois, c'est idéal)</>,
        ]}
      />
      <p className="mt-4 text-sm text-encre-light">
        💡 Plus tu en importes, plus l'app repère facilement tes abonnements et tes habitudes.
      </p>
    </div>
  )
}

function Importer() {
  const [enCours, setEnCours] = useState(false)
  const [resultats, setResultats] = useState<ImportResult[]>([])

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setEnCours(true)
    const res: ImportResult[] = []
    for (const f of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
      res.push(await importReleve(f))
      setResultats([...res])
    }
    setEnCours(false)
  }

  const ok = resultats.filter((r) => r.ok)
  const nbOps = ok.reduce((s, r) => s + (r.ok ? r.nbNouvelles : 0), 0)
  const erreurs = resultats.filter((r) => !r.ok).length

  return (
    <div>
      <Titre emoji="📥">Importe tes relevés</Titre>
      <p className="mt-3 text-encre-light">
        Sélectionne tous tes relevés d'un coup. Ils sont lus directement sur ton téléphone.
      </p>
      <label
        className={`mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-prune px-4 py-4 font-medium text-white ${
          enCours ? 'pointer-events-none opacity-70' : ''
        }`}
      >
        {enCours ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
        {enCours ? 'Lecture en cours…' : 'Choisir mes relevés'}
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            void onFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
      {resultats.length > 0 && !enCours && (
        <div className="mt-4 rounded-xl bg-white p-4 text-sm">
          {ok.length > 0 && (
            <p className="flex items-center gap-2 font-medium text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> {ok.length} relevé{ok.length > 1 ? 's' : ''} importé
              {ok.length > 1 ? 's' : ''} · {nbOps} opérations
            </p>
          )}
          {erreurs > 0 && (
            <p className="mt-1 text-peche-dark">
              {erreurs} fichier{erreurs > 1 ? 's' : ''} n'a pas pu être lu : vérifie que ce sont bien des relevés LCL.
            </p>
          )}
        </div>
      )}
      <p className="mt-4 text-sm text-encre-light">Pas tes relevés sous la main ? Tu pourras les importer plus tard depuis l'onglet Opérations.</p>
    </div>
  )
}

function Installer({ prenom }: { prenom: string }) {
  const appareil = detecterAppareil()
  const [installee, setInstallee] = useState(estInstallee())
  const [direct, setDirect] = useState(installationDirectePossible())
  const [sauver, setSauver] = useState(false)

  useEffect(() => surChangementInstallation(() => setDirect(installationDirectePossible())), [])

  return (
    <div>
      <Titre emoji="📲">Garde l'app à portée de main</Titre>

      {installee ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-white p-3 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-5 w-5" /> L'app est déjà installée sur ton écran d'accueil
        </p>
      ) : (
        <>
          <p className="mt-3 text-encre-light">
            Ajoute-la à ton écran d'accueil : elle s'ouvrira comme une vraie app, même sans internet, et tes données seront
            mieux protégées.
          </p>
          {direct ? (
            <button
              onClick={() => void installerDirectement().then((ok) => ok && setInstallee(true))}
              className="mt-4 w-full rounded-2xl bg-prune py-3 font-medium text-white"
            >
              Installer l'app
            </button>
          ) : appareil === 'iphone' ? (
            <Etapes
              items={[
                <>Ouvre l'app dans <span className="font-medium">Safari</span> (pas dans une autre app)</>,
                <>Appuie sur le bouton <span className="font-medium">Partager</span> ⬆️ en bas de l'écran</>,
                <>Choisis <span className="font-medium">« Sur l'écran d'accueil »</span>, puis <span className="font-medium">Ajouter</span></>,
              ]}
            />
          ) : appareil === 'android' ? (
            <Etapes
              items={[
                <>Ouvre l'app dans <span className="font-medium">Chrome</span></>,
                <>Appuie sur le menu <span className="font-medium">⋮</span> en haut à droite</>,
                <>Choisis <span className="font-medium">« Installer l'application »</span> (ou « Ajouter à l'écran d'accueil »)</>,
              ]}
            />
          ) : (
            <p className="mt-4 rounded-xl bg-white p-3 text-sm">
              💻 Tu es sur un ordinateur : l'app fonctionne très bien ici. Pour l'avoir dans ta poche, ouvre la même
              adresse sur ton téléphone.
            </p>
          )}
        </>
      )}

      <div className="mt-6 rounded-2xl bg-peche-light p-4 text-sm text-peche-dark">
        <p className="font-medium">💾 Dernier conseil{prenom.trim() ? `, ${prenom.trim()}` : ''}</p>
        <p className="mt-1">
          Fais une sauvegarde une fois par mois, protégée par un mot de passe. Si tu changes de téléphone, tu retrouveras
          tout.
        </p>
        <button onClick={() => setSauver(true)} className="mt-3 w-full rounded-xl bg-white py-2 font-medium text-prune">
          Faire ma première sauvegarde
        </button>
      </div>

      {sauver && <SauvegarderSheet onClose={() => setSauver(false)} />}
    </div>
  )
}
