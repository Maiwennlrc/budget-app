/**
 * Comment résilier : lien direct pour les services vérifiés, sinon une recherche.
 * Rien n'est envoyé : c'est un simple lien que l'utilisatrice ouvre elle-même.
 */
export interface GuideResiliation {
  url: string | null
  libelleBouton: string
  etapes: string[]
}

const GUIDES: [RegExp, GuideResiliation][] = [
  [
    /NETFLIX/,
    {
      url: 'https://www.netflix.com/cancelplan',
      libelleBouton: 'Ouvrir la page de résiliation Netflix',
      etapes: ['Connecte-toi si besoin', 'Clique sur « Annuler »', "Confirme l'annulation"],
    },
  ],
  [
    /GOOGLE ONE/,
    {
      url: 'https://one.google.com',
      libelleBouton: 'Ouvrir Google One',
      etapes: ['Connecte-toi avec ton compte Google', 'En haut à droite : Paramètres', "« Annuler l'abonnement », puis confirme"],
    },
  ],
  [
    /^SFR$/,
    {
      url: 'https://www.sfr.fr',
      libelleBouton: 'Ouvrir le site SFR',
      etapes: ['Connecte-toi à ton espace client', 'Rubrique « Mon offre »', '« Résilier mon offre », puis suis les étapes'],
    },
  ],
]

export function guideResiliation(nom: string, classement: string): GuideResiliation {
  const haut = nom.toUpperCase()
  for (const [re, guide] of GUIDES) if (re.test(haut)) return guide
  if (classement === 'frais') {
    return {
      url: null,
      libelleBouton: '',
      etapes: [
        'Ces frais font partie de ton offre bancaire LCL',
        'Demande à ton conseiller (Messagerie de ton espace LCL) si une formule moins chère existe',
        "Ou vérifie si une option (assurance, forfait) peut être retirée de ton offre",
      ],
    }
  }
  return {
    url: `https://www.google.com/search?q=${encodeURIComponent(`résilier abonnement ${nom}`)}`,
    libelleBouton: `Chercher comment résilier ${nom}`,
    etapes: [`Ouvre le site officiel de ${nom}`, 'Va dans ton espace client ou « Mon compte »', 'Cherche le bouton « Résilier votre contrat »'],
  }
}
