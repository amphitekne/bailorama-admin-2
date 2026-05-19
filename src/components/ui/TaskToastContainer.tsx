import { useState } from 'react'
import { X, CheckCircle, AlertCircle, Loader2, PlayCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useTaskManager } from '../../context/TaskContext'
import type { BackgroundTask, TaskType } from '../../api/endpoints/tasks'

const TASK_LABELS: Record<TaskType, string> = {
  extract_from_image: 'Extracción de flyer',
  create_from_instagram_post: 'Evento desde Instagram',
}

interface ResultViewerProps {
  task: BackgroundTask
  onClose: () => void
}

function ExtractFromImageResult({ task, onClose }: ResultViewerProps) {
  type ExtractedEvent = {
    title: string | null
    description: string | null
    starts_at: string | null
    dance_types: string[] | null
    address: string | null
    venue: string | null
  }
  const events = (task.result?.social_events ?? []) as ExtractedEvent[]

  return (
    <div className="mt-3 space-y-2">
      {events.length === 0 ? (
        <p className="text-sm text-text/60">No se extrajeron eventos.</p>
      ) : (
        events.map((e, i) => (
          <div key={i} className="rounded-md bg-base border border-text/10 p-3 text-xs space-y-1">
            <p className="font-medium text-text">{e.title ?? '—'}</p>
            {e.starts_at && (
              <p className="text-text/60">{new Date(e.starts_at).toLocaleString('es-ES')}</p>
            )}
            {e.address && <p className="text-text/60">{e.address}</p>}
            {Array.isArray(e.dance_types) && e.dance_types.length > 0 && (
              <p className="text-text/60">{e.dance_types.join(', ')}</p>
            )}
          </div>
        ))
      )}
      <p className="text-xs text-text/40 mt-1">
        Para crear los eventos, abre el procesador de flyer con la imagen original.
      </p>
      <button
        onClick={onClose}
        className="mt-1 text-xs text-primary hover:underline"
      >
        Cerrar
      </button>
    </div>
  )
}

function CreateFromInstagramResult({ task, onClose }: ResultViewerProps) {
  type CreatedEvent = { id: string; name: string; starts_at: string }
  const events = (task.result?.social_events ?? []) as CreatedEvent[]

  return (
    <div className="mt-3 space-y-2">
      {events.length === 0 ? (
        <p className="text-sm text-text/60">No se crearon eventos.</p>
      ) : (
        events.map((e) => (
          <div key={e.id} className="rounded-md bg-base border border-text/10 p-3 text-xs">
            <p className="font-medium text-text">{e.name}</p>
            <p className="text-text/60">{new Date(e.starts_at).toLocaleString('es-ES')}</p>
          </div>
        ))
      )}
      <button
        onClick={onClose}
        className="mt-1 text-xs text-primary hover:underline"
      >
        Cerrar
      </button>
    </div>
  )
}

function TaskToast({ task }: { task: BackgroundTask }) {
  const { dismiss } = useTaskManager()
  const [expanded, setExpanded] = useState(false)

  const label = TASK_LABELS[task.type] ?? task.type
  const summary =
    task.type === 'create_from_instagram_post'
      ? (task.input_summary?.instagram_post_url as string | undefined)
      : (task.input_summary?.filename as string | undefined)

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    dismiss(task.id)
  }

  return (
    <div
      className={`w-80 rounded-xl border shadow-lg p-4 transition-all
        ${task.status === 'error'
          ? 'bg-raised border-red-500/30'
          : task.status === 'done'
          ? 'bg-raised border-emerald-500/30'
          : task.status === 'awaiting_action'
          ? 'bg-raised border-amber-500/30'
          : 'bg-raised border-text/10'
        }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {task.status === 'pending' && (
            <Loader2 size={16} className="animate-spin text-primary" />
          )}
          {task.status === 'awaiting_action' && (
            <PlayCircle size={16} className="text-amber-500" />
          )}
          {task.status === 'done' && (
            <CheckCircle size={16} className="text-emerald-500" />
          )}
          {task.status === 'error' && (
            <AlertCircle size={16} className="text-red-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text leading-tight">{label}</p>
          {summary && (
            <p className="text-xs text-text/50 truncate mt-0.5">{summary}</p>
          )}
          {task.status === 'pending' && (
            <p className="text-xs text-text/40 mt-0.5">Procesando en segundo plano…</p>
          )}
          {task.status === 'awaiting_action' && (
            <p className="text-xs text-amber-500 mt-0.5">Extracción lista — abre el panel para continuar</p>
          )}
          {task.status === 'error' && (
            <p className="text-xs text-red-400 mt-0.5">{task.error ?? 'Error desconocido'}</p>
          )}
          {task.status === 'done' && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Ver resultado <ChevronDown size={12} />
            </button>
          )}
          {task.status === 'done' && expanded && (
            <>
              <button
                onClick={() => setExpanded(false)}
                className="mt-1 inline-flex items-center gap-1 text-xs text-text/40 hover:text-text"
              >
                Ocultar <ChevronUp size={12} />
              </button>
              {task.type === 'extract_from_image' && (
                <ExtractFromImageResult task={task} onClose={() => setExpanded(false)} />
              )}
              {task.type === 'create_from_instagram_post' && (
                <CreateFromInstagramResult task={task} onClose={() => setExpanded(false)} />
              )}
            </>
          )}
        </div>

        {task.status !== 'awaiting_action' && (
          <button
            onClick={handleDismiss}
            className="shrink-0 text-text/30 hover:text-text transition-colors"
            aria-label="Cerrar notificación"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

export function TaskToastContainer() {
  const { tasks } = useTaskManager()

  const visible = tasks.filter((t) => t.status !== 'awaiting_action')

  if (visible.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 items-end">
      {visible.map((task) => (
        <TaskToast key={task.id} task={task} />
      ))}
    </div>
  )
}
