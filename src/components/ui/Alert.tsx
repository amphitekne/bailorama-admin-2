import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'

type AlertVariant = 'good' | 'warning' | 'critical' | 'info'

interface AlertProps {
  variant?: AlertVariant
  children: ReactNode
  className?: string
}

const variantConfig: Record<
  AlertVariant,
  { Icon: React.FC<{ className?: string }>; styles: string }
> = {
  good: {
    Icon: CheckCircle,
    styles: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  },
  warning: {
    Icon: AlertTriangle,
    styles: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
  },
  critical: {
    Icon: XCircle,
    styles: 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400',
  },
  info: {
    Icon: Info,
    styles: 'bg-primary/10 border-primary/20 text-primary-dark',
  },
}

export function Alert({ variant = 'info', children, className = '' }: AlertProps) {
  const { Icon, styles } = variantConfig[variant]
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3.5 ${styles} ${className}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span className="text-sm leading-relaxed">{children}</span>
    </div>
  )
}
