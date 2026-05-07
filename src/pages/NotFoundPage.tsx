import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-4">
      <div className="text-center">
        <p className="text-7xl font-bold text-primary/20">404</p>
        <h1 className="mt-2 text-lg font-semibold text-text">Page not found</h1>
        <p className="mt-1 text-sm text-text/40">The page you're looking for doesn't exist.</p>
        <Link to="/dashboard" className="mt-6 inline-block">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
