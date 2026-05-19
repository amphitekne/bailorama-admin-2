import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  listTasks,
  getTask,
  completeTask as apiCompleteTask,
  dismissTask as apiDismissTask,
  type BackgroundTask,
} from '../api/endpoints/tasks'

interface TaskContextValue {
  tasks: BackgroundTask[]
  registerTask: (taskId: string) => void
  complete: (taskId: string) => Promise<void>
  dismiss: (taskId: string) => Promise<void>
}

const TaskContext = createContext<TaskContextValue | null>(null)

const POLL_INTERVAL_MS = 3000

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<BackgroundTask[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tasksRef = useRef<BackgroundTask[]>([])
  tasksRef.current = tasks

  const upsertTask = useCallback((task: BackgroundTask) => {
    setTasks((prev) => {
      const exists = prev.find((t) => t.id === task.id)
      return exists
        ? prev.map((t) => (t.id === task.id ? task : t))
        : [task, ...prev]
    })
  }, [])

  // Hydrate on mount — silently ignore auth errors (not logged in yet)
  useEffect(() => {
    listTasks()
      .then((all) => setTasks(all))
      .catch(() => {})
  }, [])

  // Poll pending tasks
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    intervalRef.current = setInterval(() => {
      const pending = tasksRef.current.filter((t) => t.status === 'pending')
      if (pending.length === 0) return
      Promise.all(pending.map((t) => getTask(t.id).then(upsertTask).catch(() => {})))
    }, POLL_INTERVAL_MS)


    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [upsertTask])

  const registerTask = useCallback(
    (taskId: string) => {
      getTask(taskId).then(upsertTask).catch(() => {})
    },
    [upsertTask],
  )

  const complete = useCallback(async (taskId: string) => {
    await apiCompleteTask(taskId)
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'done' as const } : t))
  }, [])

  const dismiss = useCallback(async (taskId: string) => {
    await apiDismissTask(taskId)
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }, [])

  return (
    <TaskContext.Provider value={{ tasks, registerTask, complete, dismiss }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTaskManager() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTaskManager must be used inside TaskProvider')
  return ctx
}
