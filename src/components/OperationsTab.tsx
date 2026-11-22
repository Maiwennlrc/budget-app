import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CheckCircle2, FileUp, Loader2, XCircle } from 'lucide-react'
import { db, type Transaction } from '../db.ts'
import { importReleve, type ImportResult } from '../lib/importReleves.ts'
import { formatEuros } from '../lib/money.ts'
import { formatJourCourt, formatJourLong, formatMois } from '../lib/dates.ts'
import { CLASSEMENTS, classer, nomMarchand } from '../lib/categories.ts'
import { jourOperation } from '../lib/cycles.ts'
import { useRegles } from '../hooks/useRegles.ts'
import OperationSheet from './OperationSheet.tsx'

export default function OperationsTab() {
  const [enCours, setEnCours] = useState(false)
  const [resultats, setResultats] = useState<ImportResult[]>([])
  const operations = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), [])

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setEnCours(true)
    setResultats([])
    const res: ImportResult[] = []
    // On importe du plus ancien au plus récent (les noms LCL finissent par la date).
    for (const f of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
      res.push(await importReleve(f))
      setResultats([...res])
    }
    setEnCours(false)
  }

  return (
    <div className="space-y-4">
      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-prune px-4 py-4 font-medium text-white active:scale-[0.98] ${
          enCours ? 'pointer-events-none opacity-70' : ''
        }`}
      >
        {enCours ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
        {enCours ? 'Lecture en cours…' : 'Importer mes relevés'}
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

      {resultats.length > 0 && (
        <ul className="space-y-2">
          {resultats.map((r, i) => (
            <ResultatCard key={i} r={r} />
          ))}
        </ul>
      )}

      {operations && operations.length === 0 && resultats.length === 0 && <EtatVide />}
      {operations && operations.length > 0 && <ListeOperations operations={operations} />}
    </div>
  )
}

function ResultatCard({ r }: { r: ImportResult }) {
  if (!r.ok) {
    return (
      <li className="flex gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
        <XCircle className="h-5 w-5 shrink-0 text-red-600" />
        <div>
          <p className="font-medium">{r.fichier}</p>
          <p className="text-encre-light">{r.erreur}</p>
        </div>
      </li>
    )
  }
  const periode =
    r.periodeDebut && r.periodeFin
      ? `Relevé du ${formatJourLong(r.periodeDebut)} au ${formatJourLong(r.periodeFin)}`
      : r.fichier
  return (
    <li className="flex gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
      {r.soldeVerifie ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <AlertTriangle className="h-5 w-5 shrink-0 text-peche-dark" />
      )}
      <div>
        <p className="font-medium">{periode}</p>
        <p className="text-encre-light">
          {r.nbNouvelles === 0
            ? 'Déjà importé, rien de nouveau 👌'
            : `${r.nbNouvelles} opération${r.nbNouvelles > 1 ? 's' : ''} ajoutée${r.nbNouvelles > 1 ? 's' : ''}`}
          {r.nbNouvelles > 0 && r.nbNouvelles < r.nbOperations && ` (${r.nbOperations - r.nbNouvelles} déjà connues)`}
        </p>
        <p className={r.soldeVerifie ? 'text-emerald-700' : 'text-peche-dark'}>
          {r.soldeVerifie
            ? 'Comptes justes au centime près ✨'
            : `Attention : écart de ${formatEuros(Math.abs(r.ecart ?? 0))} avec le solde du relevé`}
        </p>
      </div>
    </li>
  )
}

function EtatVide() {
  return (
    <div className="rounded-2xl bg-white p-5 text-sm shadow-sm">
      <p className="font-medium">Commence par tes relevés LCL 📄</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-encre-light">
        <li>Connecte-toi sur LCL.fr</li>
        <li>
          Va dans <span className="font-medium text-encre">Documents → Relevés de compte de dépôt</span>
        </li>
        <li>Télécharge les derniers mois</li>
        <li>Appuie sur « Importer mes relevés » et sélectionne-les tous d'un coup</li>
      </ol>
      <p className="mt-3 text-encre-light">Tes relevés sont lus dans ton téléphone et ne sont envoyés nulle part.</p>
    </div>
  )
}

function ListeOperations({ operations }: { operations: Transaction[] }) {
  const regles = useRegles()
  const [ouverte, setOuverte] = useState<Transaction | null>(null)
  if (!regles) return null

  // On trie et on regroupe selon la date réelle de la dépense (date d'achat pour la carte).
  const triees = [...operations].sort((a, b) => jourOperation(b).localeCompare(jourOperation(a)))
  const parMois = new Map<string, Transaction[]>()
  for (const o of triees) {
    const cle = jourOperation(o).slice(0, 7)
    parMois.set(cle, [...(parMois.get(cle) ?? []), o])
  }
  const aClasser = operations.filter((o) => classer(o, regles) === 'a-classer').length

  return (
    <div className="space-y-4">
      {aClasser > 0 && (
        <p className="rounded-2xl bg-peche-light px-4 py-3 text-sm text-peche-dark">
          ❓ {aClasser} opération{aClasser > 1 ? 's' : ''} à classer : appuie dessus pour choisir une catégorie.
        </p>
      )}
      {[...parMois.entries()].map(([mois, ops]) => (
        <section key={mois}>
          <h2 className="mb-2 px-1 text-sm font-semibold text-encre-light first-letter:uppercase">
            {formatMois(`${mois}-01`)} · {ops.length} opération{ops.length > 1 ? 's' : ''}
          </h2>
          <ul className="divide-y divide-prune-light overflow-hidden rounded-2xl bg-white shadow-sm">
            {ops.map((o) => {
              const c = classer(o, regles)
              return (
                <li key={o.id}>
                  <button
                    onClick={() => setOuverte(o)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-creme"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${
                        c === 'a-classer' ? 'bg-peche-light' : 'bg-prune-light'
                      }`}
                    >
                      {CLASSEMENTS[c].emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{nomMarchand(o)}</span>
                      <span className="block text-xs text-encre-light">
                        {formatJourCourt(jourOperation(o))} · {CLASSEMENTS[c].label}
                        {o.devise && ` · ${formatEuros(o.devise.montant).replace('€', o.devise.devise)}`}
                      </span>
                    </span>
                    <span className={`shrink-0 text-sm font-semibold ${o.montant > 0 ? 'text-emerald-700' : ''}`}>
                      {o.montant > 0 ? '+' : ''}
                      {formatEuros(o.montant)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {ouverte && (
        <OperationSheet
          operation={operations.find((o) => o.id === ouverte.id) ?? ouverte}
          toutes={operations}
          regles={regles}
          onClose={() => setOuverte(null)}
        />
      )}
    </div>
  )
}
