import { Menu, Bell } from 'lucide-react'

interface TopBarProps {
  title: string
  onMenuClick: () => void
  onBellClick: () => void
  badgeCount: number
}

export function TopBar({ title, onMenuClick, onBellClick, badgeCount }: TopBarProps) {
  return (
    <header className="flex h-13 shrink-0 items-center gap-3 border-b border-text/10 bg-base px-4">
      <button
        onClick={onMenuClick}
        className="md:hidden rounded-lg p-1.5 text-text/40 hover:bg-raised hover:text-text"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>
      <h1 className="text-sm font-semibold text-text flex-1">{title}</h1>
      <button
        onClick={onBellClick}
        className="relative rounded-lg p-1.5 text-text/40 hover:bg-raised hover:text-text transition-colors"
        aria-label="Tareas en segundo plano"
      >
        <Bell className="size-5" />
        {badgeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white leading-none">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>
    </header>
  )
}
