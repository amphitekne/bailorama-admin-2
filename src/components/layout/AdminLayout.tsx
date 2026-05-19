import { useEffect, useState } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { TaskPanel } from '../ui/TaskPanel'
import { ProcessEventFlyerDialog } from '../../pages/actions/ProcessEventFlyerDialog'
import { useTaskManager } from '../../context/TaskContext'
import type { BackgroundTask } from '../../api/endpoints/tasks'

function usePageTitle(): string {
  const location = useLocation()
  const { table, id } = useParams<{ table?: string; id?: string }>()

  if (location.pathname === '/dashboard') return 'Dashboard'
  if (location.pathname === '/actions') return 'Actions'
  if (table) {
    const label = table.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    if (location.pathname.endsWith('/create')) return `New ${label}`
    if (id) return `Edit ${label}`
    return label
  }
  return 'Admin'
}

export function AdminLayout() {
  const title = usePageTitle()
  const location = useLocation()
  const { tasks } = useTaskManager()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [taskPanelOpen, setTaskPanelOpen] = useState(false)
  const [resumeTask, setResumeTask] = useState<BackgroundTask | null>(null)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const badgeCount = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'awaiting_action'
  ).length

  const handleContinueTask = (task: BackgroundTask) => {
    setTaskPanelOpen(false)
    setResumeTask(task)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-base">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-text/30 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — drawer on mobile, static on md+ */}
      <div
        className={`fixed inset-y-0 left-0 z-40 md:relative md:z-auto md:flex ${
          sidebarOpen ? 'flex' : 'hidden'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
          onBellClick={() => setTaskPanelOpen(true)}
          badgeCount={badgeCount}
        />
        <main className="flex-1 overflow-y-auto p-3 md:p-6">
          <Outlet />
        </main>
      </div>

      <TaskPanel
        open={taskPanelOpen}
        onClose={() => setTaskPanelOpen(false)}
        onContinueTask={handleContinueTask}
      />

      <ProcessEventFlyerDialog
        open={resumeTask !== null && resumeTask.type === 'extract_from_image'}
        onClose={() => setResumeTask(null)}
        resumeTask={resumeTask?.type === 'extract_from_image' ? resumeTask : undefined}
      />
    </div>
  )
}
