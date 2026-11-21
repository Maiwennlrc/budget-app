import { useState } from 'react'
import { LayoutDashboard, Receipt, SearchCheck, Settings, type LucideIcon } from 'lucide-react'

type TabId = 'dashboard' | 'transactions' | 'audit' | 'settings'

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
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
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <current.icon className="mx-auto mb-3 h-10 w-10 text-prune" />
          <p className="font-medium">L'onglet « {current.label} » arrive bientôt</p>
          <p className="mt-1 text-sm text-encre-light">On construit ça ensemble, étape par étape.</p>
        </div>
        <div className="mt-3 rounded-2xl bg-peche-light p-4 text-sm text-peche-dark">
          Bientôt ici : tes abonnements à passer en revue ✨
        </div>
      </main>

      <nav className="grid grid-cols-4 border-t border-prune-light bg-white pb-[env(safe-area-inset-bottom)]">
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
