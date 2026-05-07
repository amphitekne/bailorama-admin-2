import { LayoutDashboard, Database, LogOut, ChevronRight, Zap, X } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { clearAccessToken } from '../../auth/tokenStorage'
import { useSchema } from '../../context/SchemaContext'
import { Spinner } from '../ui/Spinner'

function modelLabel(model: string) {
  return model.replace(/ORM$/i, '').replace(/([A-Z])/g, ' $1').trim()
}

interface SidebarProps {
  onClose: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const navigate = useNavigate()
  const schemaState = useSchema()

  function handleLogout() {
    clearAccessToken()
    void navigate('/login')
  }

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-raised border-r border-text/10">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-text/10">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-white">B</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-widest text-text uppercase leading-tight">
            Bailorama
          </p>
          <p className="text-[10px] text-text/30 leading-tight">admin</p>
        </div>
        <button
          onClick={onClose}
          className="md:hidden rounded-lg p-1.5 text-text/40 hover:bg-overlay hover:text-text"
          aria-label="Close menu"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {/* Dashboard */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-text/50 hover:bg-overlay hover:text-text'
            }`
          }
        >
          <LayoutDashboard className="size-4 shrink-0" />
          Dashboard
        </NavLink>

        {/* Actions */}
        <NavLink
          to="/actions"
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-text/50 hover:bg-overlay hover:text-text'
            }`
          }
        >
          <Zap className="size-4 shrink-0" />
          Actions
        </NavLink>

        {/* Resources section */}
        <div className="mt-4 mb-1 px-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text/25">
            Resources
          </p>
        </div>

        {schemaState.status === 'loading' && (
          <div className="flex items-center gap-2 px-3 py-2">
            <Spinner size="sm" />
            <span className="text-xs text-text/30">Loading…</span>
          </div>
        )}

        {schemaState.status === 'error' && (
          <p className="px-3 py-1 text-xs text-red-400">Schema error</p>
        )}

        {schemaState.status === 'ready' &&
          schemaState.models.map((model) => (
            <NavLink
              key={model.table}
              to={`/resources/${model.table}`}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-text/50 hover:bg-overlay hover:text-text'
                }`
              }
            >
              <Database className="size-3.5 shrink-0 opacity-60" />
              <span className="flex-1 truncate">{modelLabel(model.model)}</span>
              <ChevronRight className="size-3 shrink-0 opacity-30" />
            </NavLink>
          ))}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-text/10">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-text/40 transition-colors hover:bg-overlay hover:text-text"
        >
          <LogOut className="size-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
