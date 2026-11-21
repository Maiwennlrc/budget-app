import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Demande au navigateur de ne pas effacer nos données quand il manque de place.
void navigator.storage?.persist?.()

// Mises à jour automatiques : dès qu'une nouvelle version est publiée sur GitHub,
// l'app la télécharge puis se recharge toute seule.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const verifier = () => void registration.update().catch(() => {})
    // Sur iPhone, une app rouverte depuis le sélecteur n'est pas rechargée :
    // on vérifie donc à chaque fois qu'elle revient au premier plan, et toutes les heures.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') verifier()
    })
    setInterval(verifier, 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
