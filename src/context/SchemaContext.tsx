import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getCrudSchema } from '../api/endpoints/crud'
import type { CrudModelSchema } from '../api/types'

type SchemaState =
  | { status: 'loading' }
  | { status: 'ready'; models: CrudModelSchema[] }
  | { status: 'error'; error: string }

const SchemaContext = createContext<SchemaState>({ status: 'loading' })

export function SchemaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SchemaState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    getCrudSchema()
      .then((schema) => {
        if (!cancelled) setState({ status: 'ready', models: schema })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({
            status: 'error',
            error: e instanceof Error ? e.message : 'Failed to load schema',
          })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return <SchemaContext.Provider value={state}>{children}</SchemaContext.Provider>
}

export function useSchema(): SchemaState {
  return useContext(SchemaContext)
}

export function useModelByTable(table: string): CrudModelSchema | null {
  const state = useContext(SchemaContext)
  if (state.status !== 'ready') return null
  return state.models.find((m) => m.table === table) ?? null
}
