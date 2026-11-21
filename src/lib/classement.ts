import type { ReleveOperation } from './lcl/parseReleve.ts'

/**
 * Le « type » d'une opération, qui décide si elle compte dans « Dépensé ».
 * Il est recalculé à chaque affichage (pas stocké) : si on améliore les règles,
 * toutes les anciennes opérations en profitent automatiquement.
 */
export type TypeOperation = 'depense' | 'revenu' | 'epargne' | 'remboursement'

const RE_EPARGNE = /PREDICA|ASSURANCE VIE|LCL VIE|LIVRET|EPARGNE|PEL\b|CEL\b/i

type OpPourClassement = Pick<ReleveOperation, 'montant' | 'libelle' | 'details'>

export function typeOperation(o: OpPourClassement): TypeOperation {
  const texte = [o.libelle, ...o.details].join(' ')
  if (o.montant < 0) {
    return RE_EPARGNE.test(texte) ? 'epargne' : 'depense'
  }
  // MP2P = virement entre particuliers (Wero, virement instantané d'un·e ami·e).
  if (/NATURE DU PAIEMENT:\s*MP2P/.test(texte) || /\bWERO\b/i.test(texte)) return 'remboursement'
  return 'revenu'
}

export const LIBELLES_TYPE: Record<TypeOperation, string> = {
  depense: 'Dépense',
  revenu: 'Revenu',
  epargne: 'Épargne',
  remboursement: 'Remboursement',
}
