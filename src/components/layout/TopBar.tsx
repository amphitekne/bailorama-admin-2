import { Menu } from 'lucide-react'

interface TopBarProps {
  title: string
  onMenuClick: () => void
}

export function TopBar({ title, onMenuClick }: TopBarProps) {
  return (
    <header className="flex h-13 shrink-0 items-center gap-3 border-b border-text/10 bg-base px-4">
      <button
        onClick={onMenuClick}
        className="md:hidden rounded-lg p-1.5 text-text/40 hover:bg-raised hover:text-text"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>
      <h1 className="text-sm font-semibold text-text">{title}</h1>
    </header>
  )
}
