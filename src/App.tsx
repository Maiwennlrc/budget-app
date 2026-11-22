import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, LayoutDashboard, Receipt, SearchCheck, Settings, type LucideIcon } from 'lucide-react'
import DashboardTab from './components/DashboardTab.tsx'
import OperationsTab from './components/OperationsTab.tsx'
import MonthsTab from './components/MonthsTab.tsx'
import AuditTab from './components/AuditTab.tsx'
import SettingsTab from './components/SettingsTab.tsx'
import Onboarding, { META_GUIDE, META_PRENOM } from './components/Onboarding.tsx'
import { db } from './db.ts'

type TabId = 'dashboard' | 'months' | 'transactions' | 'audit' | 'settings'

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
  { id: 'months', label: 'Mois', icon: BarChart3 },
  { id: 'transactions', label: 'Opérations', icon: Receipt },
  { id: 'audit', label: 'Audit', icon: SearchCheck },
  { id: 'settings', label: 'Réglages', icon: Settings },
]

export default function App() {
  // Les onglets sont un simple état React : pas de routeur,
  // donc pas d'erreur 404 au rechargement sur GitHub Pages.
  const [tab, setTab] = useState<TabId>('dashboard')
  const current = TABS.find((t) => t.id === tab)!
  // null = pas encore décidé. Une fois ouvert, le guide reste affiché jusqu'à la fin,
  // même si l'import ajoute des opérations en cours de route.
  const [guideOuvert, setGuideOuvert] = useState<boolean | null>(null)

  // Premier lancement : aucune opération et guide jamais terminé (ou passé).
  const etat = useLiveQuery(async () => {
    const [nb, guide, prenom] = await Promise.all([db.transactions.count(), db.meta.get(META_GUIDE), db.meta.get(META_PRENOM)])
    return { nb, guideFait: !!guide, prenom: prenom?.valeur ?? '' }
  }, [])
  useEffect(() => {
    if (etat && guideOuvert === null) setGuideOuvert(!etat.guideFait && etat.nb === 0)
  }, [etat, guideOuvert])

  if (!etat || guideOuvert === null) return null

  if (guideOuvert) {
    return (
      <Onboarding
        prenomActuel={etat.prenom}
        onFin={() => {
          setGuideOuvert(false)
          setTab('dashboard')
        }}
      />
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col bg-creme sm:border-x sm:border-prune-light">
      <header className="bg-prune px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <p className="text-sm text-white/80">Salut{etat.prenom ? ` ${etat.prenom}` : ''} 👋</p>
        <h1 className="text-xl font-semibold">{tab === 'dashboard' ? 'Mon budget' : current.label}</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {tab === 'dashboard' && (
          <DashboardTab
            allerAuxOperations={() => setTab('transactions')}
            allerALAudit={() => setTab('audit')}
            allerAuxReglages={() => setTab('settings')}
          />
        )}
        {tab === 'months' && <MonthsTab allerAuxOperations={() => setTab('transactions')} />}
        {tab === 'transactions' && <OperationsTab />}
        {tab === 'audit' && <AuditTab allerAuxOperations={() => setTab('transactions')} />}
        {tab === 'settings' && <SettingsTab prenom={etat.prenom} revoirGuide={() => setGuideOuvert(true)} />}
      </main>

      <nav className="grid grid-cols-5 border-t border-prune-light bg-white pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-col items-center gap-1 py-3 text-xs ${
              tab === id ? 'text-prune' : 'text-encre-light/60'
            }`}
          >
            <Icon className="h-6 w-6" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
