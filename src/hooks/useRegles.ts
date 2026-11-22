import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db.ts'
import type { Classement } from '../lib/categories.ts'

/** Les règles « Toujours ranger X dans Y », sous forme de dictionnaire clé → classement. */
export function useRegles(): Map<string, Classement> | undefined {
  const regles = useLiveQuery(() => db.regles.toArray(), [])
  return useMemo(() => (regles ? new Map(regles.map((r) => [r.cle, r.classement])) : undefined), [regles])
}
