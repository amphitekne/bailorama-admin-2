import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { getAccessToken } from './auth/tokenStorage'
import { SchemaProvider } from './context/SchemaContext'
import { AdminLayout } from './components/layout/AdminLayout'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ResourceListPage } from './pages/resources/ResourceListPage'
import { ResourceFormPage } from './pages/resources/ResourceFormPage'
import { ActionsPage } from './pages/actions/ActionsPage'

function AuthGuard() {
  if (!getAccessToken()) {
    return <Navigate to="/login" replace />
  }
  return (
    <SchemaProvider>
      <Outlet />
    </SchemaProvider>
  )
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AuthGuard />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'actions', element: <ActionsPage /> },
          { path: 'resources/:table', element: <ResourceListPage /> },
          { path: 'resources/:table/create', element: <ResourceFormPage /> },
          { path: 'resources/:table/:id', element: <ResourceFormPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
], { basename: '/admin' })
