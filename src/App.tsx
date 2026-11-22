import { useState } from 'react'
import { BarChart3, LayoutDashboard, Receipt, SearchCheck, Settings, type LucideIcon } from 'lucide-react'
import DashboardTab from './components/DashboardTab.tsx'
import OperationsTab from './components/OperationsTab.tsx'
import MonthsTab from './components/MonthsTab.tsx'
import AuditTab from './components/AuditTab.tsx'
import SettingsTab from './components/SettingsTab.tsx'

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

  return (
    <div className="mx-auto flex h-full max-w-md flex-col bg-creme sm:border-x sm:border-prune-light">
      <header className="bg-prune px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <p className="text-sm text-white/80">Salut 👋</p>
        <h1 className="text-xl font-semibold">{tab === 'dashboard' ? 'Mon budget' : current.label}</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {tab === 'dashboard' && <DashboardTab allerAuxOperations={() => setTab('transactions')} allerALAudit={() => setTab('audit')} />}
        {tab === 'months' && <MonthsTab allerAuxOperations={() => setTab('transactions')} />}
        {tab === 'transactions' && <OperationsTab />}
        {tab === 'audit' && <AuditTab allerAuxOperations={() => setTab('transactions')} />}
        {tab === 'settings' && <SettingsTab />}
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
