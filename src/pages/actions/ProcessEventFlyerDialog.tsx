import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, ArrowRight } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { Toggle } from '../../components/ui/Toggle'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { Checkbox } from '../../components/ui/Checkbox'
import { apiClient } from '../../api/client'
import { useTaskManager } from '../../context/TaskContext'
import { AddVenueDialog } from './AddVenueDialog'
import type { BackgroundTask } from '../../api/endpoints/tasks'

interface Props {
  open: boolean
  onClose: () => void
  resumeTask?: BackgroundTask
}

type PublisherRecord = {
  id: string
  name: string | null
  fallback_venue_id?: string | null
  fallback_venue?: { id?: string | null } | null
  venue_id?: string | null
  venue?: { id?: string | null } | null
}

type VenueCandidate = {
  id: string
  name: string
  location: { id: string; formatted_address: string } | null
}

type VenueCrudRecord = {
  id: string
  location_id?: string | null
  location?: { id?: string | null } | null
}

const DANCE_TYPE_OPTIONS = ['salsa', 'bachata', 'kizomba', 'other'] as const
type DanceType = typeof DANCE_TYPE_OPTIONS[number]

type ExtractedEvent = {
  title: string | null
  description: string | null
  starts_at: string | null
  dance_types: DanceType[] | null
  address: string | null
  venue: string | null
}

type EditableEvent = {
  include: boolean
  title: string
  description: string
  startsAt: string
  danceTypes: DanceType[]
  address: string
  venueDisplay: string
  venueId: string
  inheritFromPublisher: boolean
  locationId: string
  forceActivation: boolean
}

function getPublisherVenueId(p: PublisherRecord): string {
  return p.fallback_venue_id ?? p.fallback_venue?.id ?? p.venue_id ?? p.venue?.id ?? ''
}

function toLocalDateTime(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function toUtcIso(localDateTime: string): string {
  return new Date(localDateTime).toISOString()
}

function IconBtn({
  onClick,
  title,
  disabled,
  children,
}: {
  onClick: () => void
  title: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-6 flex size-10 shrink-0 items-center justify-center rounded-lg border border-text/15 bg-raised text-text/60 hover:bg-overlay hover:text-text transition-colors disabled:opacity-40 disabled:pointer-events-none"
      title={title}
    >
      {children}
    </button>
  )
}

export function ProcessEventFlyerDialog({ open, onClose, resumeTask }: Props) {
  const { tasks, registerTask, complete } = useTaskManager()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [postUrl, setPostUrl] = useState('')
  const [publisherId, setPublisherId] = useState('')
  const [publisherVenueId, setPublisherVenueId] = useState('')
  const [publisherVenueLoading, setPublisherVenueLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'extracting' | 'sending' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)

  const [previewEvents, setPreviewEvents] = useState<EditableEvent[]>([])
  const [activeEventIndex, setActiveEventIndex] = useState<number | null>(null)
  const [eventDetailOpen, setEventDetailOpen] = useState(false)

  const [pubSearchOpen, setPubSearchOpen] = useState(false)
  const [pubQ, setPubQ] = useState('')
  const [pubCandidates, setPubCandidates] = useState<PublisherRecord[]>([])
  const [pubSearching, setPubSearching] = useState(false)

  const [venueSearchOpen, setVenueSearchOpen] = useState(false)
  const [venueQ, setVenueQ] = useState('')
  const [venueCandidates, setVenueCandidates] = useState<VenueCandidate[]>([])
  const [venueSearching, setVenueSearching] = useState(false)
  const [addVenueOpen, setAddVenueOpen] = useState(false)

  const [venueLocationId, setVenueLocationId] = useState<string | null>(null)
  const [venueLocationLoading, setVenueLocationLoading] = useState(false)

  const [createLocationOpen, setCreateLocationOpen] = useState(false)
  const [createLocationUrl, setCreateLocationUrl] = useState('')
  const [createLocationStatus, setCreateLocationStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [createLocationMsg, setCreateLocationMsg] = useState('')

  // Pre-load state when resuming an awaiting_action task
  useEffect(() => {
    if (!open || !resumeTask) return
    const extracted = (resumeTask.result?.social_events ?? []) as ExtractedEvent[]
    const savedPublisherId = (resumeTask.input_summary?.publisher_id as string | undefined) ?? ''
    setPublisherId(savedPublisherId)
    if (extracted.length > 0) {
      setPreviewEvents(extracted.map((e) => ({
        include: true,
        title: e.title ?? '',
        description: e.description ?? '',
        startsAt: toLocalDateTime(e.starts_at),
        danceTypes: Array.isArray(e.dance_types) ? e.dance_types : [],
        address: e.address ?? '',
        venueDisplay: e.venue ?? '',
        venueId: '',
        inheritFromPublisher: false,
        locationId: '',
        forceActivation: false,
      })))
    }
  }, [open, resumeTask])

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const searchPublishers = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) { setPubCandidates([]); return }
    setPubSearching(true)
    try {
      const params = new URLSearchParams({ limit: '20', offset: '0', order_by: 'id', order_dir: 'desc' })
      params.append('name__icontains', trimmed)
      const res = await apiClient.get<{ items: PublisherRecord[] }>(`/crud/publishers/search?${params}`)
      setPubCandidates(Array.isArray(res.items) ? res.items : [])
    } catch { setPubCandidates([]) }
    finally { setPubSearching(false) }
  }, [])

  const searchVenues = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) { setVenueCandidates([]); return }
    setVenueSearching(true)
    try {
      const res = await apiClient.get<{ candidates: VenueCandidate[] }>(
        `venues/autocomplete?q=${encodeURIComponent(trimmed)}&limit=10`
      )
      setVenueCandidates(res.candidates ?? [])
    } catch { setVenueCandidates([]) }
    finally { setVenueSearching(false) }
  }, [])

  useEffect(() => {
    if (!pubSearchOpen) return
    const t = setTimeout(() => searchPublishers(pubQ), 300)
    return () => clearTimeout(t)
  }, [pubQ, pubSearchOpen, searchPublishers])

  useEffect(() => {
    if (!venueSearchOpen) return
    const t = setTimeout(() => searchVenues(venueQ), 300)
    return () => clearTimeout(t)
  }, [venueQ, venueSearchOpen, searchVenues])

  useEffect(() => {
    const trimmed = publisherId.trim()
    if (!trimmed) { setPublisherVenueLoading(false); setPublisherVenueId(''); return }
    let cancelled = false
    const t = setTimeout(async () => {
      setPublisherVenueLoading(true)
      try {
        const pub = await apiClient.get<PublisherRecord>(`/crud/publishers/${encodeURIComponent(trimmed)}`)
        if (!cancelled) setPublisherVenueId(getPublisherVenueId(pub))
      } catch { if (!cancelled) setPublisherVenueId('') }
      finally { if (!cancelled) setPublisherVenueLoading(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [publisherId])

  useEffect(() => {
    if (!eventDetailOpen || activeEventIndex === null) {
      setVenueLocationId(null)
      setVenueLocationLoading(false)
      return
    }
    const active = previewEvents[activeEventIndex]
    const trimmedVenueId = active?.venueId?.trim() ?? ''
    if (!trimmedVenueId) { setVenueLocationId(null); setVenueLocationLoading(false); return }
    let cancelled = false
    const t = setTimeout(async () => {
      setVenueLocationLoading(true)
      try {
        const venue = await apiClient.get<VenueCrudRecord>(`/crud/venues/${encodeURIComponent(trimmedVenueId)}`)
        if (!cancelled) setVenueLocationId(venue.location_id ?? venue.location?.id ?? null)
      } catch { if (!cancelled) setVenueLocationId(null) }
      finally { if (!cancelled) setVenueLocationLoading(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [eventDetailOpen, activeEventIndex, previewEvents])

  const updateEvent = (index: number, patch: Partial<EditableEvent>) => {
    setPreviewEvents((prev) => prev.map((e, i) => i === index ? { ...e, ...patch } : e))
  }

  // Watch the pending extraction task and auto-populate preview when done
  useEffect(() => {
    if (!pendingTaskId) return
    const task = tasks.find((t) => t.id === pendingTaskId)
    if (!task || task.status === 'pending') return

    if (task.status === 'awaiting_action' || task.status === 'done') {
      const extracted = (task.result?.social_events ?? []) as ExtractedEvent[]
      if (extracted.length === 0) {
        setStatus('error')
        setStatusMessage('No se extrajeron eventos del flyer.')
      } else {
        setPreviewEvents(extracted.map((e) => ({
          include: true,
          title: e.title ?? '',
          description: e.description ?? '',
          startsAt: toLocalDateTime(e.starts_at),
          danceTypes: Array.isArray(e.dance_types) ? e.dance_types : [],
          address: e.address ?? '',
          venueDisplay: e.venue ?? '',
          venueId: publisherVenueId,
          inheritFromPublisher: Boolean(publisherVenueId),
          locationId: '',
          forceActivation: false,
        })))
        setStatus('idle')
        setStatusMessage('')
      }
    } else {
      setStatus('error')
      setStatusMessage(task.error ?? 'La extracción ha fallado.')
    }
    setPendingTaskId(null)
  }, [tasks, pendingTaskId, publisherVenueId])

  const handleExtract = async () => {
    if (!file) { setStatusMessage('Please upload an image.'); setStatus('error'); return }
    if (!publisherId.trim()) { setStatusMessage('Publisher ID is required.'); setStatus('error'); return }
    setStatus('extracting')
    setStatusMessage('')
    try {
      const form = new FormData()
      form.append('image', file)
      const trimmedMsg = message.trim()
      if (trimmedMsg) form.append('message', trimmedMsg)
      if (publisherId.trim()) form.append('publisher_id', publisherId.trim())
      const res = await apiClient.post<{ task_id: string }>(
        'social-events/extract-from-image-preview',
        form
      )
      registerTask(res.task_id)
      setPendingTaskId(res.task_id)
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : 'Failed to start extraction')
      setStatus('error')
    }
  }

  const handleCreateSelected = async () => {
    const selected = previewEvents.filter((e) => e.include)
    if (selected.length === 0) { setStatusMessage('Select at least one event.'); setStatus('error'); return }
    if (!file) { setStatusMessage('Image is required.'); setStatus('error'); return }
    if (!publisherId.trim()) { setStatusMessage('Publisher ID is required.'); setStatus('error'); return }
    for (const e of selected) {
      if (!e.title.trim() || !e.description.trim() || !e.startsAt.trim() || e.danceTypes.length === 0 || !e.locationId.trim()) {
        setStatusMessage('Each selected event must have title, description, starts at, dance types, and location ID.')
        setStatus('error')
        return
      }
    }
    setStatus('sending')
    setStatusMessage('')
    try {
      for (const e of selected) {
        const form = new FormData()
        form.append('image', file)
        form.append('name', e.title.trim())
        form.append('description', e.description.trim())
        form.append('starts_at', toUtcIso(e.startsAt))
        e.danceTypes.forEach((dt) => form.append('dance_types', dt))
        if (e.venueId.trim()) form.append('venue_id', e.venueId.trim())
        form.append('location_id', e.locationId.trim())
        form.append('publisher_id', publisherId.trim())
        form.append('force_activation', String(e.forceActivation))
        if (postUrl.trim()) form.append('post_url', postUrl.trim())
        await apiClient.post('social-events/new', form)
      }
      setStatus('success')
      setStatusMessage(`Created ${selected.length} social event${selected.length === 1 ? '' : 's'}.`)
      if (resumeTask) {
        complete(resumeTask.id).catch(() => {})
      } else if (pendingTaskId) {
        complete(pendingTaskId).catch(() => {})
      }
      setFile(null)
      setMessage('')
      setPostUrl('')
      setPublisherId('')
      setPreviewEvents([])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create social events'
      setStatusMessage(msg.includes('409')
        ? 'Conflict: verify publisher_id and venue_id, and confirm publisher has a fallback venue.'
        : msg)
      setStatus('error')
    }
  }

  const handleCreateLocation = async () => {
    if (activeEventIndex === null) return
    const trimmed = createLocationUrl.trim()
    if (!trimmed) { setCreateLocationStatus('error'); setCreateLocationMsg('Google Maps URL is required.'); return }
    setCreateLocationStatus('submitting')
    setCreateLocationMsg('')
    try {
      const res = await apiClient.post<{ location: { id: string } }>(
        `locations/?${new URLSearchParams({ maps_url: trimmed })}`
      )
      if (res?.location?.id) updateEvent(activeEventIndex, { locationId: res.location.id })
      setCreateLocationStatus('idle')
      setCreateLocationMsg('')
      setCreateLocationUrl('')
      setCreateLocationOpen(false)
    } catch (e) {
      setCreateLocationStatus('error')
      setCreateLocationMsg(e instanceof Error ? e.message : 'Failed to create location')
    }
  }

  const handleClose = () => {
    setFile(null)
    setPreviewUrl(null)
    setMessage('')
    setPostUrl('')
    setPublisherId('')
    setPublisherVenueId('')
    setPublisherVenueLoading(false)
    setStatus('idle')
    setStatusMessage('')
    setPreviewEvents([])
    setActiveEventIndex(null)
    setEventDetailOpen(false)
    setPubSearchOpen(false)
    setPubQ('')
    setPubCandidates([])
    setVenueSearchOpen(false)
    setVenueQ('')
    setVenueCandidates([])
    setAddVenueOpen(false)
    setVenueLocationId(null)
    setVenueLocationLoading(false)
    setCreateLocationOpen(false)
    setCreateLocationUrl('')
    setCreateLocationStatus('idle')
    setCreateLocationMsg('')
    setPendingTaskId(null)
    onClose()
  }

  const isResume = Boolean(resumeTask)

  const activeEvent = activeEventIndex !== null ? previewEvents[activeEventIndex] ?? null : null
  const canInheritLocation =
    Boolean(activeEvent?.venueId.trim()) && Boolean(venueLocationId) && !venueLocationLoading

  const toggleDanceType = (index: number, dt: DanceType) => {
    const current = previewEvents[index].danceTypes
    updateEvent(index, {
      danceTypes: current.includes(dt) ? current.filter((d) => d !== dt) : [...current, dt],
    })
  }

  return (
    <>
      {/* Main dialog */}
      <Modal
        open={open}
        onClose={handleClose}
        title="Process event flyer"
        footer={
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button
              variant="secondary"
              onClick={handleExtract}
              loading={status === 'extracting'}
              disabled={status === 'extracting' || status === 'sending' || !file || !publisherId.trim()}
            >
              {status === 'extracting' ? 'Extrayendo…' : 'Extract events'}
            </Button>
            <Button
              onClick={handleCreateSelected}
              loading={status === 'sending'}
              disabled={status === 'extracting' || status === 'sending' || previewEvents.filter((e) => e.include).length === 0}
            >
              {status === 'sending'
                ? 'Creating…'
                : `Create selected (${previewEvents.filter((e) => e.include).length})`}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {isResume ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <p className="text-sm font-medium text-amber-500">Reanudando extracción anterior</p>
              <p className="mt-0.5 text-xs text-text/60">
                Los eventos ya han sido extraídos. Sube de nuevo el flyer para poder crearlos.
              </p>
            </div>
          ) : (
            <p className="text-sm text-text/60">
              Upload an event flyer image and extract events using AI. Publisher ID is required; venue ID is optional.
            </p>
          )}

          {/* Image */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Image</label>
            <label className="cursor-pointer">
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-text/15 bg-raised px-4 text-sm text-text hover:bg-overlay transition-colors">
                {file ? file.name : 'Upload image'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setStatus('idle'); setStatusMessage('') } }}
              />
            </label>
          </div>
          {previewUrl && (
            <div className="border border-text/10 rounded-lg overflow-hidden max-h-48 flex justify-center bg-overlay">
              <img src={previewUrl} alt="Flyer preview" className="max-w-full max-h-48 object-contain" />
            </div>
          )}

          <Textarea
            label="Message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Description or context for the AI extractor"
          />
          <Input
            label="Post URL (optional)"
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="https://..."
          />

          {/* Publisher */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Publisher ID"
                value={publisherId}
                onChange={(e) => setPublisherId(e.target.value)}
                placeholder={publisherVenueLoading ? 'Checking publisher…' : 'Publisher identifier'}
                required
              />
            </div>
            <IconBtn onClick={() => setPubSearchOpen(true)} title="Search publisher"><Search size={16} /></IconBtn>
          </div>

          {/* Extracted events list */}
          {previewEvents.length > 0 && (
            <div className="border border-text/10 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-xs font-semibold text-text/60 uppercase tracking-wide">Extracted events</p>
              {previewEvents.map((evt, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 border border-text/10 rounded-lg px-3 py-2"
                >
                  <span className="text-sm text-text">
                    {evt.title || `Event ${i + 1}`}
                  </span>
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => { setActiveEventIndex(i); setEventDetailOpen(true) }}
                    >
                      Edit
                    </Button>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={evt.include}
                        onChange={(e) => updateEvent(i, { include: e.target.checked })}
                      />
                      <span className="text-xs text-text/60">Include</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          {status === 'extracting' && (
            <div className="flex items-center gap-3 rounded-lg border border-text/10 bg-raised px-4 py-3">
              <Spinner size="sm" />
              <div>
                <p className="text-sm text-text">Extrayendo eventos en segundo plano…</p>
                <p className="text-xs text-text/50 mt-0.5">Puedes cerrar este diálogo y volver cuando termine.</p>
              </div>
            </div>
          )}
          {status === 'success' && <Alert variant="good">{statusMessage}</Alert>}
          {status === 'error' && <Alert variant="critical">{statusMessage}</Alert>}
        </div>
      </Modal>

      {/* Publisher search */}
      <Modal open={pubSearchOpen} onClose={() => setPubSearchOpen(false)} title="Search publisher" size="sm"
        footer={<Button variant="secondary" onClick={() => setPubSearchOpen(false)}>Close</Button>}
      >
        <div className="flex flex-col gap-3">
          <Input placeholder="Type at least 2 characters..." value={pubQ} onChange={(e) => setPubQ(e.target.value)} />
          {pubSearching && <div className="flex justify-center py-2"><Spinner /></div>}
          <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
            {pubCandidates.map((c) => (
              <button key={c.id} onClick={() => {
                setPublisherId(c.id)
                setPublisherVenueId(getPublisherVenueId(c))
                setPubSearchOpen(false); setPubQ(''); setPubCandidates([])
              }} className="text-left px-3 py-2 rounded-lg hover:bg-overlay transition-colors">
                <div className="text-sm font-medium text-text">{c.name || c.id}</div>
                <div className="text-xs text-text/50">{c.id}</div>
              </button>
            ))}
            {!pubSearching && pubCandidates.length === 0 && pubQ.trim().length >= 2 && (
              <p className="text-sm text-text/50 text-center py-3">No results found</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Event detail / edit modal */}
      {activeEvent && activeEventIndex !== null && (
        <Modal
          open={eventDetailOpen}
          onClose={() => setEventDetailOpen(false)}
          title={`Edit event ${activeEventIndex + 1}`}
          size="lg"
          footer={<Button variant="secondary" onClick={() => setEventDetailOpen(false)}>Close</Button>}
        >
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={activeEvent.include}
                onChange={(e) => updateEvent(activeEventIndex, { include: e.target.checked })}
              />
              <span className="text-sm text-text">Include in creation</span>
            </label>

            <Input
              label="Title"
              value={activeEvent.title}
              onChange={(e) => updateEvent(activeEventIndex, { title: e.target.value })}
              required
            />
            <Textarea
              label="Description"
              value={activeEvent.description}
              onChange={(e) => updateEvent(activeEventIndex, { description: e.target.value })}
              required
            />
            <Input
              label="Starts at"
              type="datetime-local"
              value={activeEvent.startsAt}
              onChange={(e) => updateEvent(activeEventIndex, { startsAt: e.target.value })}
              required
            />

            {/* Dance types */}
            <fieldset>
              <legend className="text-sm font-medium text-text mb-2">Dance types</legend>
              <div className="flex flex-wrap gap-4">
                {DANCE_TYPE_OPTIONS.map((dt) => (
                  <label key={dt} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={activeEvent.danceTypes.includes(dt)}
                      onChange={() => toggleDanceType(activeEventIndex, dt)}
                    />
                    <span className="text-sm text-text capitalize">{dt}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Input
              label="Address (display)"
              value={activeEvent.address}
              onChange={(e) => updateEvent(activeEventIndex, { address: e.target.value })}
            />
            <Input
              label="Venue (display name)"
              value={activeEvent.venueDisplay}
              onChange={(e) => updateEvent(activeEventIndex, { venueDisplay: e.target.value })}
            />

            {/* Venue ID */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  label="Venue ID (optional override)"
                  value={activeEvent.venueId}
                  onChange={(e) => updateEvent(activeEventIndex, { venueId: e.target.value, inheritFromPublisher: false })}
                />
              </div>
              <IconBtn onClick={() => setVenueSearchOpen(true)} title="Search venue"><Search size={16} /></IconBtn>
              <IconBtn onClick={() => setAddVenueOpen(true)} title="Create venue"><Plus size={16} /></IconBtn>
            </div>
            {publisherVenueId && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={activeEvent.inheritFromPublisher}
                  onChange={(e) => {
                    if (!publisherVenueId) return
                    updateEvent(activeEventIndex, {
                      inheritFromPublisher: e.target.checked,
                      venueId: e.target.checked ? publisherVenueId : activeEvent.venueId,
                    })
                  }}
                />
                <span className="text-sm text-text">Inherit from publisher ({publisherVenueId})</span>
              </label>
            )}

            {/* Location ID */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  label="Location ID"
                  value={activeEvent.locationId}
                  onChange={(e) => updateEvent(activeEventIndex, { locationId: e.target.value })}
                  required
                />
              </div>
              <IconBtn
                onClick={() => venueLocationId && updateEvent(activeEventIndex, { locationId: venueLocationId })}
                title={
                  !activeEvent.venueId.trim() ? 'Select a venue first'
                    : venueLocationLoading ? 'Loading venue location'
                    : !venueLocationId ? 'Venue has no location'
                    : 'Use venue location'
                }
                disabled={!canInheritLocation}
              >
                <ArrowRight size={16} />
              </IconBtn>
              <IconBtn onClick={() => setCreateLocationOpen(true)} title="Create location"><Plus size={16} /></IconBtn>
            </div>
            <p className="text-xs text-text/40 -mt-2">Required. Must be a valid location ID.</p>

            <Toggle
              checked={activeEvent.forceActivation}
              onChange={(v) => updateEvent(activeEventIndex, { forceActivation: v })}
              label="Force activation"
            />
          </div>
        </Modal>
      )}

      {/* Venue search (for event detail) */}
      <Modal open={venueSearchOpen} onClose={() => setVenueSearchOpen(false)} title="Search venue" size="sm"
        footer={<Button variant="secondary" onClick={() => setVenueSearchOpen(false)}>Close</Button>}
      >
        <div className="flex flex-col gap-3">
          <Input placeholder="Type at least 2 characters..." value={venueQ} onChange={(e) => setVenueQ(e.target.value)} />
          {venueSearching && <div className="flex justify-center py-2"><Spinner /></div>}
          <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
            {venueCandidates.map((c) => (
              <button key={c.id} onClick={() => {
                if (activeEventIndex !== null) {
                  updateEvent(activeEventIndex, { venueId: c.id, inheritFromPublisher: false })
                }
                setVenueSearchOpen(false); setVenueQ(''); setVenueCandidates([])
              }} className="text-left px-3 py-2 rounded-lg hover:bg-overlay transition-colors">
                <div className="text-sm font-medium text-text">{c.name}</div>
                <div className="text-xs text-text/50">{c.location?.formatted_address ?? c.id}</div>
              </button>
            ))}
            {!venueSearching && venueCandidates.length === 0 && venueQ.trim().length >= 2 && (
              <p className="text-sm text-text/50 text-center py-3">No results found</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Create location (for event detail) */}
      <Modal open={createLocationOpen} onClose={() => setCreateLocationOpen(false)} title="Create location" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateLocationOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateLocation}
              loading={createLocationStatus === 'submitting'}
              disabled={createLocationStatus === 'submitting' || !createLocationUrl.trim()}
            >
              {createLocationStatus === 'submitting' ? 'Creating…' : 'Create location'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Google Maps URL"
            value={createLocationUrl}
            onChange={(e) => {
              setCreateLocationUrl(e.target.value)
              if (createLocationStatus === 'error') { setCreateLocationStatus('idle'); setCreateLocationMsg('') }
            }}
            placeholder="https://maps.google.com/..."
          />
          {createLocationStatus === 'error' && <Alert variant="critical">{createLocationMsg}</Alert>}
        </div>
      </Modal>

      <AddVenueDialog
        open={addVenueOpen}
        onClose={() => setAddVenueOpen(false)}
        onCreated={(id) => {
          if (activeEventIndex !== null) updateEvent(activeEventIndex, { venueId: id, inheritFromPublisher: false })
          setAddVenueOpen(false)
        }}
      />
    </>
  )
}
