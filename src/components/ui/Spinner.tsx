interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'size-3.5 border-2',
  md: 'size-5 border-2',
  lg: 'size-8 border-[3px]',
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={`${sizes[size]} ${className} animate-spin rounded-full border-text/20 border-t-primary`}
      role="status"
      aria-label="Loading"
    />
  )
}
