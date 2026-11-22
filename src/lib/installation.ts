// Aide à l'installation de l'app sur l'écran d'accueil.

export type Appareil = 'iphone' | 'android' | 'ordinateur'

export function detecterAppareil(): Appareil {
  const ua = navigator.userAgent
  // Les iPad récents se présentent comme un Mac : on les repère à l'écran tactile.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iphone'
  if (/Android/.test(ua)) return 'android'
  return 'ordinateur'
}

/** true si l'app est déjà ouverte depuis l'écran d'accueil (installée). */
export function estInstallee(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

// Sur Android (Chrome), le navigateur propose un événement qui permet d'afficher
// notre propre bouton « Installer l'app ». On le garde de côté dès le démarrage.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let invitation: BeforeInstallPromptEvent | null = null
const abonnes = new Set<() => void>()

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  invitation = e as BeforeInstallPromptEvent
  abonnes.forEach((f) => f())
})
window.addEventListener('appinstalled', () => {
  invitation = null
  abonnes.forEach((f) => f())
})

export const installationDirectePossible = () => invitation !== null
export function surChangementInstallation(f: () => void): () => void {
  abonnes.add(f)
  return () => abonnes.delete(f)
}

/** Ouvre la fenêtre d'installation du navigateur. Renvoie true si l'utilisatrice a accepté. */
export async function installerDirectement(): Promise<boolean> {
  if (!invitation) return false
  await invitation.prompt()
  const { outcome } = await invitation.userChoice
  invitation = null
  abonnes.forEach((f) => f())
  return outcome === 'accepted'
}
