import { useCallback, useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Toggle } from '../../components/ui/Toggle'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { apiClient } from '../../api/client'
import { useTaskManager } from '../../context/TaskContext'
import { AddPublisherDialog } from './AddPublisherDialog'
import { AddVenueDialog } from './AddVenueDialog'

interface Props {
  open: boolean
  onClose: () => void
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

function getPublisherVenueId(p: PublisherRecord): string {
  return p.fallback_venue_id ?? p.fallback_venue?.id ?? p.venue_id ?? p.venue?.id ?? ''
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-6 flex size-10 shrink-0 items-center justify-center rounded-lg border border-text/15 bg-raised text-text/60 hover:bg-overlay hover:text-text transition-colors"
      title={title}
    >
      {children}
    </button>
  )
}

export function AddSocialEventsFromPostDialog({ open, onClose }: Props) {
  const { registerTask } = useTaskManager()
  const [postUrl, setPostUrl] = useState('')
  const [publisherId, setPublisherId] = useState('')
  const [venueId, setVenueId] = useState('')
  const [forceActivation, setForceActivation] = useState(false)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [publisherVenueLoading, setPublisherVenueLoading] = useState(false)

  const [pubSearchOpen, setPubSearchOpen] = useState(false)
  const [pubQ, setPubQ] = useState('')
  const [pubCandidates, setPubCandidates] = useState<PublisherRecord[]>([])
  const [pubSearching, setPubSearching] = useState(false)
  const [addPubOpen, setAddPubOpen] = useState(false)

  const [venueSearchOpen, setVenueSearchOpen] = useState(false)
  const [venueQ, setVenueQ] = useState('')
  const [venueCandidates, setVenueCandidates] = useState<VenueCandidate[]>([])
  const [venueSearching, setVenueSearching] = useState(false)
  const [addVenueOpen, setAddVenueOpen] = useState(false)

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
    if (!trimmed) { setPublisherVenueLoading(false); return }
    let cancelled = false
    const t = setTimeout(async () => {
      setPublisherVenueLoading(true)
      try {
        const pub = await apiClient.get<PublisherRecord>(`/crud/publishers/${encodeURIComponent(trimmed)}`)
        const inherited = getPublisherVenueId(pub)
        if (!cancelled && inherited) setVenueId(inherited)
      } catch {}
      finally { if (!cancelled) setPublisherVenueLoading(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [publisherId])

  const handleSubmit = async () => {
    if (!postUrl.trim()) { setMessage('Instagram post URL is required.'); setStatus('error'); return }
    if (!publisherId.trim()) { setMessage('Publisher ID is required.'); setStatus('error'); return }
    setStatus('submitting')
    setMessage('')
    try {
      const res = await apiClient.post<{ task_id: string }>(
        'social-events/create-from-instagram-post-url',
        {
          instagram_post_url: postUrl.trim(),
          publisher_id: publisherId.trim(),
          venue_id: venueId.trim() || null,
          force_activation: forceActivation,
        }
      )
      registerTask(res.task_id)
      setStatus('success')
      setMessage('Procesando en segundo plano. Te notificaremos cuando el evento esté listo.')
      setPostUrl('')
      setPublisherId('')
      setVenueId('')
      setForceActivation(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed'
      setMessage(msg.includes('409') ? 'Conflict: verify publisher_id and venue_id.' : msg)
      setStatus('error')
    }
  }

  const handleClose = () => {
    setPostUrl('')
    setPublisherId('')
    setVenueId('')
    setForceActivation(false)
    setStatus('idle')
    setMessage('')
    setPubSearchOpen(false)
    setPubQ('')
    setPubCandidates([])
    setVenueSearchOpen(false)
    setVenueQ('')
    setVenueCandidates([])
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Create from Instagram post"
        footer={
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              loading={status === 'submitting'}
              disabled={status === 'submitting' || !postUrl.trim() || !publisherId.trim()}
            >
              {status === 'submitting' ? 'Creating…' : 'Create social events'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text/60">
            Create social events from an Instagram post URL. Publisher is required; venue is an optional override.
          </p>
          <Input
            label="Instagram post URL"
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/..."
            required
          />
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
            <IconBtn onClick={() => setAddPubOpen(true)} title="Create publisher"><Plus size={16} /></IconBtn>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Venue ID (optional override)"
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
              />
            </div>
            <IconBtn onClick={() => setVenueSearchOpen(true)} title="Search venue"><Search size={16} /></IconBtn>
            <IconBtn onClick={() => setAddVenueOpen(true)} title="Create venue"><Plus size={16} /></IconBtn>
          </div>
          <Toggle checked={forceActivation} onChange={setForceActivation} label="Force activation" />
          {status === 'success' && <Alert variant="good">{message}</Alert>}
          {status === 'error' && <Alert variant="critical">{message}</Alert>}
        </div>
      </Modal>

      <Modal
        open={pubSearchOpen}
        onClose={() => setPubSearchOpen(false)}
        title="Search publisher"
        size="sm"
        footer={<Button variant="secondary" onClick={() => setPubSearchOpen(false)}>Close</Button>}
      >
        <div className="flex flex-col gap-3">
          <Input placeholder="Type at least 2 characters..." value={pubQ} onChange={(e) => setPubQ(e.target.value)} />
          {pubSearching && <div className="flex justify-center py-2"><Spinner /></div>}
          <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
            {pubCandidates.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  const inherited = getPublisherVenueId(c)
                  setPublisherId(c.id)
                  if (inherited) setVenueId(inherited)
                  setPubSearchOpen(false); setPubQ(''); setPubCandidates([])
                }}
                className="text-left px-3 py-2 rounded-lg hover:bg-overlay transition-colors"
              >
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

      <Modal
        open={venueSearchOpen}
        onClose={() => setVenueSearchOpen(false)}
        title="Search venue"
        size="sm"
        footer={<Button variant="secondary" onClick={() => setVenueSearchOpen(false)}>Close</Button>}
      >
        <div className="flex flex-col gap-3">
          <Input placeholder="Type at least 2 characters..." value={venueQ} onChange={(e) => setVenueQ(e.target.value)} />
          {venueSearching && <div className="flex justify-center py-2"><Spinner /></div>}
          <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
            {venueCandidates.map((c) => (
              <button
                key={c.id}
                onClick={() => { setVenueId(c.id); setVenueSearchOpen(false); setVenueQ(''); setVenueCandidates([]) }}
                className="text-left px-3 py-2 rounded-lg hover:bg-overlay transition-colors"
              >
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

      <AddPublisherDialog open={addPubOpen} onClose={() => setAddPubOpen(false)} />
      <AddVenueDialog
        open={addVenueOpen}
        onClose={() => setAddVenueOpen(false)}
        onCreated={(id) => { setVenueId(id); setAddVenueOpen(false) }}
      />
    </>
  )
}
