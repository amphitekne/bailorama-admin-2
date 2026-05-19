import { X, CheckCircle, AlertCircle, Loader2, PlayCircle, ChevronRight } from 'lucide-react'
import { useTaskManager } from '../../context/TaskContext'
import type { BackgroundTask, TaskType } from '../../api/endpoints/tasks'

const TASK_LABELS: Record<TaskType, string> = {
  extract_from_image: 'Extracción de flyer',
  create_from_instagram_post: 'Evento desde Instagram',
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.floor(hours / 24)} d`
}

function StatusIcon({ status }: { status: BackgroundTask['status'] }) {
  if (status === 'pending') return <Loader2 size={14} className="animate-spin text-primary shrink-0" />
  if (status === 'awaiting_action') return <PlayCircle size={14} className="text-amber-500 shrink-0" />
  if (status === 'done') return <CheckCircle size={14} className="text-emerald-500 shrink-0" />
  return <AlertCircle size={14} className="text-red-500 shrink-0" />
}

interface TaskRowProps {
  task: BackgroundTask
  onContinue?: (task: BackgroundTask) => void
}

function TaskRow({ task, onContinue }: TaskRowProps) {
  const { dismiss } = useTaskManager()
  const label = TASK_LABELS[task.type] ?? task.type
  const summary =
    task.type === 'create_from_instagram_post'
      ? (task.input_summary?.instagram_post_url as string | undefined)
      : (task.input_summary?.filename as string | undefined)

  return (
    <div className="flex items-start gap-3 rounded-lg border border-text/10 bg-raised p-3">
      <StatusIcon status={task.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text leading-tight">{label}</p>
        {summary && <p className="text-xs text-text/50 truncate mt-0.5">{summary}</p>}
        {task.status === 'pending' && (
          <p className="text-xs text-text/40 mt-0.5">Procesando…</p>
        )}
        {task.status === 'awaiting_action' && (
          <p className="text-xs text-amber-500 mt-0.5">Requiere acción</p>
        )}
        {task.status === 'error' && (
          <p className="text-xs text-red-400 mt-0.5 line-clamp-2">{task.error ?? 'Error desconocido'}</p>
        )}
        {task.status === 'done' && (
          <p className="text-xs text-emerald-500 mt-0.5">Completado</p>
        )}
        <p className="text-xs text-text/30 mt-1">{formatRelativeTime(task.updated_at)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {task.status === 'awaiting_action' && onContinue && (
          <button
            onClick={() => onContinue(task)}
            className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-500 hover:bg-amber-500/20 transition-colors"
          >
            Continuar <ChevronRight size={12} />
          </button>
        )}
        {(task.status === 'done' || task.status === 'error') && (
          <button
            onClick={() => dismiss(task.id)}
            className="rounded-md p-1 text-text/30 hover:text-text transition-colors"
            aria-label="Descartar"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

interface TaskPanelProps {
  open: boolean
  onClose: () => void
  onContinueTask?: (task: BackgroundTask) => void
}

export function TaskPanel({ open, onClose, onContinueTask }: TaskPanelProps) {
  const { tasks } = useTaskManager()

  const pending = tasks.filter((t) => t.status === 'pending')
  const awaitingAction = tasks.filter((t) => t.status === 'awaiting_action')
  const done = tasks.filter((t) => t.status === 'done' || t.status === 'error')

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-text/20 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed right-0 top-0 z-50 h-full w-80 bg-base border-l border-text/10 shadow-xl flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-13 shrink-0 items-center justify-between border-b border-text/10 px-4">
          <h2 className="text-sm font-semibold text-text">Tareas en segundo plano</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text/40 hover:bg-raised hover:text-text transition-colors"
            aria-label="Cerrar panel"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {tasks.length === 0 && (
            <p className="text-sm text-text/40 text-center mt-8">No hay tareas recientes.</p>
          )}

          {awaitingAction.length > 0 && (
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-amber-500">
                Requieren acción ({awaitingAction.length})
              </p>
              <div className="flex flex-col gap-2">
                {awaitingAction.map((t) => (
                  <TaskRow key={t.id} task={t} onContinue={onContinueTask} />
                ))}
              </div>
            </section>
          )}

          {pending.length > 0 && (
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text/40">
                En progreso ({pending.length})
              </p>
              <div className="flex flex-col gap-2">
                {pending.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text/40">
                Historial ({done.length})
              </p>
              <div className="flex flex-col gap-2">
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
