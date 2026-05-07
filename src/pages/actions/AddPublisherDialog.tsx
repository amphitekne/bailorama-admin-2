import { useCallback, useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { apiClient } from '../../api/client'
import { AddInstagramAccountDialog } from './AddInstagramAccountDialog'
import { AddVenueDialog } from './AddVenueDialog'

interface Props {
  open: boolean
  onClose: () => void
}

type InstagramAccountRecord = { id: string; account: string | null }
type VenueRecord = { id: string; name: string | null }

function SearchIconBtn({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-6 flex size-10 shrink-0 items-center justify-center rounded-lg border border-text/15 bg-raised text-text/60 hover:bg-overlay hover:text-text transition-colors"
      title={title}
    >
      <Search size={16} />
    </button>
  )
}

function PlusIconBtn({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-6 flex size-10 shrink-0 items-center justify-center rounded-lg border border-text/15 bg-raised text-text/60 hover:bg-overlay hover:text-text transition-colors"
      title={title}
    >
      <Plus size={16} />
    </button>
  )
}

export function AddPublisherDialog({ open, onClose }: Props) {
  const [name, setName] = useState('')
  const [instagramAccountId, setInstagramAccountId] = useState('')
  const [venueId, setVenueId] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const [igSearchOpen, setIgSearchOpen] = useState(false)
  const [igQ, setIgQ] = useState('')
  const [igCandidates, setIgCandidates] = useState<InstagramAccountRecord[]>([])
  const [igSearching, setIgSearching] = useState(false)
  const [addIgOpen, setAddIgOpen] = useState(false)

  const [venueSearchOpen, setVenueSearchOpen] = useState(false)
  const [venueQ, setVenueQ] = useState('')
  const [venueCandidates, setVenueCandidates] = useState<VenueRecord[]>([])
  const [venueSearching, setVenueSearching] = useState(false)
  const [addVenueOpen, setAddVenueOpen] = useState(false)

  const searchIg = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) { setIgCandidates([]); return }
    setIgSearching(true)
    try {
      const params = new URLSearchParams({ limit: '20', offset: '0', order_by: 'id', order_dir: 'desc' })
      params.append('account__icontains', trimmed)
      const res = await apiClient.get<{ items: InstagramAccountRecord[] }>(
        `/crud/instagram_accounts/search?${params}`
      )
      setIgCandidates(Array.isArray(res.items) ? res.items : [])
    } catch { setIgCandidates([]) }
    finally { setIgSearching(false) }
  }, [])

  const searchVenues = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) { setVenueCandidates([]); return }
    setVenueSearching(true)
    try {
      const params = new URLSearchParams({ limit: '20', offset: '0', order_by: 'id', order_dir: 'desc' })
      params.append('name__icontains', trimmed)
      const res = await apiClient.get<{ items: VenueRecord[] }>(`/crud/venues/search?${params}`)
      setVenueCandidates(Array.isArray(res.items) ? res.items : [])
    } catch { setVenueCandidates([]) }
    finally { setVenueSearching(false) }
  }, [])

  useEffect(() => {
    if (!igSearchOpen) return
    const t = setTimeout(() => searchIg(igQ), 300)
    return () => clearTimeout(t)
  }, [igQ, igSearchOpen, searchIg])

  useEffect(() => {
    if (!venueSearchOpen) return
    const t = setTimeout(() => searchVenues(venueQ), 300)
    return () => clearTimeout(t)
  }, [venueQ, venueSearchOpen, searchVenues])

  const handleSubmit = async () => {
    if (!name.trim()) { setMessage('Name is required.'); setStatus('error'); return }
    if (!instagramAccountId.trim()) { setMessage('Instagram account ID is required.'); setStatus('error'); return }
    setStatus('submitting')
    setMessage('')
    try {
      const params = new URLSearchParams({ name: name.trim(), instagram_account_id: instagramAccountId.trim() })
      if (venueId.trim()) params.set('venue_id', venueId.trim())
      await apiClient.post(`publishers/?${params}`)
      setStatus('success')
      setMessage('Publisher created successfully.')
      setName('')
      setInstagramAccountId('')
      setVenueId('')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to create publisher')
      setStatus('error')
    }
  }

  const handleClose = () => {
    setName('')
    setInstagramAccountId('')
    setVenueId('')
    setStatus('idle')
    setMessage('')
    setIgSearchOpen(false)
    setIgQ('')
    setIgCandidates([])
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
        title="Add publisher"
        footer={
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              loading={status === 'submitting'}
              disabled={status === 'submitting' || !name.trim() || !instagramAccountId.trim()}
            >
              {status === 'submitting' ? 'Creating…' : 'Create publisher'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text/60">Create a publisher and link it to an Instagram account and a fallback venue.</p>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Instagram account ID"
                value={instagramAccountId}
                onChange={(e) => setInstagramAccountId(e.target.value)}
                required
              />
            </div>
            <SearchIconBtn onClick={() => setIgSearchOpen(true)} title="Search Instagram account" />
            <PlusIconBtn onClick={() => setAddIgOpen(true)} title="Create Instagram account" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Venue ID (optional)"
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
              />
            </div>
            <SearchIconBtn onClick={() => setVenueSearchOpen(true)} title="Search venue" />
            <PlusIconBtn onClick={() => setAddVenueOpen(true)} title="Create venue" />
          </div>
          {status === 'success' && <Alert variant="good">{message}</Alert>}
          {status === 'error' && <Alert variant="critical">{message}</Alert>}
        </div>
      </Modal>

      <Modal
        open={igSearchOpen}
        onClose={() => setIgSearchOpen(false)}
        title="Search Instagram account"
        size="sm"
        footer={<Button variant="secondary" onClick={() => setIgSearchOpen(false)}>Close</Button>}
      >
        <div className="flex flex-col gap-3">
          <Input placeholder="Type at least 2 characters..." value={igQ} onChange={(e) => setIgQ(e.target.value)} />
          {igSearching && <div className="flex justify-center py-2"><Spinner /></div>}
          <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
            {igCandidates.map((c) => (
              <button
                key={c.id}
                onClick={() => { setInstagramAccountId(c.id); setIgSearchOpen(false); setIgQ(''); setIgCandidates([]) }}
                className="text-left px-3 py-2 rounded-lg hover:bg-overlay transition-colors"
              >
                <div className="text-sm font-medium text-text">@{c.account || '-'}</div>
                <div className="text-xs text-text/50">{c.id}</div>
              </button>
            ))}
            {!igSearching && igCandidates.length === 0 && igQ.trim().length >= 2 && (
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
                <div className="text-sm font-medium text-text">{c.name || c.id}</div>
                <div className="text-xs text-text/50">{c.id}</div>
              </button>
            ))}
            {!venueSearching && venueCandidates.length === 0 && venueQ.trim().length >= 2 && (
              <p className="text-sm text-text/50 text-center py-3">No results found</p>
            )}
          </div>
        </div>
      </Modal>

      <AddInstagramAccountDialog
        open={addIgOpen}
        onClose={() => setAddIgOpen(false)}
        onCreated={(id) => { setInstagramAccountId(id); setAddIgOpen(false) }}
      />
      <AddVenueDialog
        open={addVenueOpen}
        onClose={() => setAddVenueOpen(false)}
        onCreated={(id) => { setVenueId(id); setAddVenueOpen(false) }}
      />
    </>
  )
}
