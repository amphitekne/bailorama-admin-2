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

type VenueCrudRecord = {
  id: string
  location_id?: string | null
  location?: { id?: string | null } | null
}

type LocationRecord = {
  id: string
  city: string | null
  region: string | null
  full_address: string | null
  formatted_address: string | null
}

const DANCE_TYPE_OPTIONS = ['salsa', 'bachata', 'kizomba', 'other'] as const
type DanceType = typeof DANCE_TYPE_OPTIONS[number]

function getPublisherVenueId(p: PublisherRecord): string {
  return p.fallback_venue_id ?? p.fallback_venue?.id ?? p.venue_id ?? p.venue?.id ?? ''
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

export function CreateNewSocialEventDialog({ open, onClose }: Props) {
  const [image, setImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [danceTypes, setDanceTypes] = useState<DanceType[]>([])
  const [publisherId, setPublisherId] = useState('')
  const [venueId, setVenueId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [postUrl, setPostUrl] = useState('')
  const [forceActivation, setForceActivation] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  const [publisherVenueId, setPublisherVenueId] = useState<string | null>(null)
  const [publisherVenueLoading, setPublisherVenueLoading] = useState(false)
  const [usePublisherVenue, setUsePublisherVenue] = useState(false)

  const [venueLocationId, setVenueLocationId] = useState<string | null>(null)
  const [venueLocationLoading, setVenueLocationLoading] = useState(false)

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

  const [locationSearchOpen, setLocationSearchOpen] = useState(false)
  const [locationCity, setLocationCity] = useState('')
  const [locationRegion, setLocationRegion] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [locationCandidates, setLocationCandidates] = useState<LocationRecord[]>([])
  const [locationSearching, setLocationSearching] = useState(false)

  const [createLocationOpen, setCreateLocationOpen] = useState(false)
  const [createLocationUrl, setCreateLocationUrl] = useState('')
  const [createLocationStatus, setCreateLocationStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [createLocationMsg, setCreateLocationMsg] = useState('')

  useEffect(() => {
    if (!image) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(image)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

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
    if (!trimmed) { setPublisherVenueLoading(false); setPublisherVenueId(null); setUsePublisherVenue(false); return }
    let cancelled = false
    const t = setTimeout(async () => {
      setPublisherVenueLoading(true)
      try {
        const pub = await apiClient.get<PublisherRecord>(`/crud/publishers/${encodeURIComponent(trimmed)}`)
        const inherited = getPublisherVenueId(pub)
        if (!cancelled) {
          setPublisherVenueId(inherited || null)
          if (!inherited) setUsePublisherVenue(false)
        }
      } catch { if (!cancelled) { setPublisherVenueId(null); setUsePublisherVenue(false) } }
      finally { if (!cancelled) setPublisherVenueLoading(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [publisherId])

  useEffect(() => {
    if (usePublisherVenue && publisherVenueId) setVenueId(publisherVenueId)
  }, [usePublisherVenue, publisherVenueId])

  useEffect(() => {
    const trimmed = venueId.trim()
    if (!trimmed) { setVenueLocationId(null); setVenueLocationLoading(false); return }
    let cancelled = false
    const t = setTimeout(async () => {
      setVenueLocationLoading(true)
      try {
        const venue = await apiClient.get<VenueCrudRecord>(`/crud/venues/${encodeURIComponent(trimmed)}`)
        if (!cancelled) setVenueLocationId(venue.location_id ?? venue.location?.id ?? null)
      } catch { if (!cancelled) setVenueLocationId(null) }
      finally { if (!cancelled) setVenueLocationLoading(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [venueId])

  const handleLocationSearch = async () => {
    const city = locationCity.trim()
    const region = locationRegion.trim()
    const address = locationAddress.trim()
    if (!city && !region && !address) { setLocationCandidates([]); return }
    setLocationSearching(true)
    try {
      const params = new URLSearchParams({ limit: '20', offset: '0', order_by: 'id', order_dir: 'desc' })
      if (city) params.append('city__icontains', city)
      if (region) params.append('region__icontains', region)
      if (address) params.append('full_address__icontains', address)
      const res = await apiClient.get<{ items: LocationRecord[] }>(`/crud/locations/search?${params}`)
      setLocationCandidates(Array.isArray(res.items) ? res.items : [])
    } catch { setLocationCandidates([]) }
    finally { setLocationSearching(false) }
  }

  const handleCreateLocation = async () => {
    const trimmed = createLocationUrl.trim()
    if (!trimmed) { setCreateLocationStatus('error'); setCreateLocationMsg('Google Maps URL is required.'); return }
    setCreateLocationStatus('submitting')
    setCreateLocationMsg('')
    try {
      const res = await apiClient.post<{ location: { id: string } }>(
        `locations/?${new URLSearchParams({ maps_url: trimmed })}`
      )
      if (res?.location?.id) setLocationId(res.location.id)
      setCreateLocationStatus('idle')
      setCreateLocationMsg('')
      setCreateLocationUrl('')
      setCreateLocationOpen(false)
    } catch (e) {
      setCreateLocationStatus('error')
      setCreateLocationMsg(e instanceof Error ? e.message : 'Failed to create location')
    }
  }

  const handleSend = async () => {
    if (!image) { setStatusMessage('Image is required.'); setStatus('error'); return }
    if (!name.trim()) { setStatusMessage('Name is required.'); setStatus('error'); return }
    if (!description.trim()) { setStatusMessage('Description is required.'); setStatus('error'); return }
    if (!startsAt.trim()) { setStatusMessage('Start date/time is required.'); setStatus('error'); return }
    if (danceTypes.length === 0) { setStatusMessage('At least one dance type is required.'); setStatus('error'); return }
    if (!publisherId.trim()) { setStatusMessage('Publisher ID is required.'); setStatus('error'); return }
    if (!locationId.trim()) { setStatusMessage('Location ID is required.'); setStatus('error'); return }
    setStatus('sending')
    setStatusMessage('')
    try {
      const form = new FormData()
      form.append('image', image)
      form.append('name', name.trim())
      form.append('description', description.trim())
      form.append('starts_at', toUtcIso(startsAt.trim()))
      danceTypes.forEach((dt) => form.append('dance_types', dt))
      form.append('publisher_id', publisherId.trim())
      if (venueId.trim()) form.append('venue_id', venueId.trim())
      form.append('location_id', locationId.trim())
      if (postUrl.trim()) form.append('post_url', postUrl.trim())
      form.append('force_activation', String(forceActivation))
      await apiClient.post('social-events/new', form)
      setStatus('success')
      setStatusMessage('Social event created successfully.')
      setImage(null)
      setPreviewUrl(null)
      setName('')
      setDescription('')
      setStartsAt('')
      setDanceTypes([])
      setPublisherId('')
      setPublisherVenueId(null)
      setUsePublisherVenue(false)
      setVenueId('')
      setLocationId('')
      setPostUrl('')
      setForceActivation(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create social event'
      setStatusMessage(msg.includes('409')
        ? 'Conflict: verify publisher_id and venue_id, and confirm publisher has a fallback venue.'
        : msg)
      setStatus('error')
    }
  }

  const resetForm = () => {
    setImage(null)
    setPreviewUrl(null)
    setName('')
    setDescription('')
    setStartsAt('')
    setDanceTypes([])
    setPublisherId('')
    setVenueId('')
    setLocationId('')
    setPostUrl('')
    setForceActivation(false)
    setStatus('idle')
    setStatusMessage('')
    setPublisherVenueId(null)
    setPublisherVenueLoading(false)
    setUsePublisherVenue(false)
    setVenueLocationId(null)
    setVenueLocationLoading(false)
    setPubSearchOpen(false)
    setPubQ('')
    setPubCandidates([])
    setVenueSearchOpen(false)
    setVenueQ('')
    setVenueCandidates([])
    setLocationSearchOpen(false)
    setLocationCity('')
    setLocationRegion('')
    setLocationAddress('')
    setLocationCandidates([])
    setCreateLocationOpen(false)
    setCreateLocationUrl('')
    setCreateLocationStatus('idle')
    setCreateLocationMsg('')
  }

  const handleClose = () => { resetForm(); onClose() }

  const toggleDanceType = (dt: DanceType) => {
    setDanceTypes((prev) => prev.includes(dt) ? prev.filter((d) => d !== dt) : [...prev, dt])
  }

  const canInheritLocation = Boolean(venueId.trim()) && Boolean(venueLocationId) && !venueLocationLoading

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Create new social event"
        footer={
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={handleSend}
              loading={status === 'sending'}
              disabled={
                status === 'sending' || !image || !name.trim() || !description.trim() ||
                !startsAt.trim() || danceTypes.length === 0 || !publisherId.trim() || !locationId.trim()
              }
            >
              {status === 'sending' ? 'Creating…' : 'Create social event'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text/60">
            Create a social event by uploading an image. Publisher ID is required; venue ID is an optional override.
          </p>

          {/* Image */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Image *</label>
            <label className="cursor-pointer">
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-text/15 bg-raised px-4 text-sm text-text hover:bg-overlay transition-colors">
                {image ? image.name : 'Upload image'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="sr-only"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {previewUrl && (
            <div className="border border-text/10 rounded-lg overflow-hidden max-h-48 flex justify-center bg-overlay">
              <img src={previewUrl} alt="Preview" className="max-w-full max-h-48 object-contain" />
            </div>
          )}

          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} required />
          <Input
            label="Starts at"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
          <p className="text-xs text-text/40 -mt-2">Sent as UTC automatically.</p>

          {/* Dance types */}
          <fieldset>
            <legend className="text-sm font-medium text-text mb-2">Dance types *</legend>
            <div className="flex flex-wrap gap-4">
              {DANCE_TYPE_OPTIONS.map((dt) => (
                <label key={dt} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={danceTypes.includes(dt)}
                    onChange={() => toggleDanceType(dt)}
                  />
                  <span className="text-sm text-text capitalize">{dt}</span>
                </label>
              ))}
            </div>
          </fieldset>

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
            <IconBtn onClick={() => setAddPubOpen(true)} title="Create publisher"><Plus size={16} /></IconBtn>
          </div>
          {publisherVenueId && (
            <Toggle
              checked={usePublisherVenue}
              onChange={setUsePublisherVenue}
              label={`Reuse publisher venue (${publisherVenueId})`}
            />
          )}

          {/* Venue */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Venue ID (optional override)"
                value={venueId}
                onChange={(e) => { setUsePublisherVenue(false); setVenueId(e.target.value) }}
                disabled={usePublisherVenue}
              />
            </div>
            <IconBtn onClick={() => setVenueSearchOpen(true)} title="Search venue" disabled={usePublisherVenue}>
              <Search size={16} />
            </IconBtn>
            <IconBtn onClick={() => setAddVenueOpen(true)} title="Create venue" disabled={usePublisherVenue}>
              <Plus size={16} />
            </IconBtn>
          </div>

          {/* Location */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Location ID"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                required
              />
            </div>
            <IconBtn
              onClick={() => venueLocationId && setLocationId(venueLocationId)}
              title={
                !venueId.trim() ? 'Select a venue first'
                  : venueLocationLoading ? 'Loading venue location'
                  : !venueLocationId ? 'Venue has no location'
                  : 'Use venue location'
              }
              disabled={!canInheritLocation}
            >
              <ArrowRight size={16} />
            </IconBtn>
            <IconBtn onClick={() => setLocationSearchOpen(true)} title="Search location"><Search size={16} /></IconBtn>
            <IconBtn onClick={() => setCreateLocationOpen(true)} title="Create location"><Plus size={16} /></IconBtn>
          </div>
          <p className="text-xs text-text/40 -mt-2">Required. Use search or create to set a valid location.</p>

          <Input
            label="Post URL (optional)"
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="https://..."
          />
          <Toggle checked={forceActivation} onChange={setForceActivation} label="Force activation" />

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
                const inherited = getPublisherVenueId(c)
                setPublisherId(c.id)
                setPublisherVenueId(inherited || null)
                if (inherited) { setUsePublisherVenue(true); setVenueId(inherited) }
                else { setUsePublisherVenue(false) }
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

      {/* Venue search */}
      <Modal open={venueSearchOpen} onClose={() => setVenueSearchOpen(false)} title="Search venue" size="sm"
        footer={<Button variant="secondary" onClick={() => setVenueSearchOpen(false)}>Close</Button>}
      >
        <div className="flex flex-col gap-3">
          <Input placeholder="Type at least 2 characters..." value={venueQ} onChange={(e) => setVenueQ(e.target.value)} />
          {venueSearching && <div className="flex justify-center py-2"><Spinner /></div>}
          <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
            {venueCandidates.map((c) => (
              <button key={c.id} onClick={() => {
                setVenueId(c.id); setUsePublisherVenue(false)
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

      {/* Location search */}
      <Modal open={locationSearchOpen} onClose={() => setLocationSearchOpen(false)} title="Search location" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLocationSearchOpen(false)}>Close</Button>
            <Button onClick={handleLocationSearch} loading={locationSearching} disabled={locationSearching}>
              Search
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="City" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} />
          <Input label="Region" value={locationRegion} onChange={(e) => setLocationRegion(e.target.value)} />
          <Input label="Full address" value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} />
          {locationSearching && <div className="flex justify-center py-2"><Spinner /></div>}
          <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
            {locationCandidates.map((loc) => (
              <button key={loc.id} onClick={() => { setLocationId(loc.id); setLocationSearchOpen(false) }}
                className="text-left px-3 py-2 rounded-lg hover:bg-overlay transition-colors">
                <div className="text-sm font-medium text-text">
                  {loc.full_address || loc.formatted_address || loc.id}
                </div>
                <div className="text-xs text-text/50">{loc.city || '-'}, {loc.region || '-'} · {loc.id}</div>
              </button>
            ))}
            {!locationSearching && locationCandidates.length === 0 && (locationCity || locationRegion || locationAddress) && (
              <p className="text-sm text-text/50 text-center py-3">No results found</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Create location */}
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
            onChange={(e) => { setCreateLocationUrl(e.target.value); if (createLocationStatus === 'error') { setCreateLocationStatus('idle'); setCreateLocationMsg('') } }}
            placeholder="https://maps.google.com/..."
          />
          {createLocationStatus === 'error' && <Alert variant="critical">{createLocationMsg}</Alert>}
        </div>
      </Modal>

      <AddPublisherDialog open={addPubOpen} onClose={() => setAddPubOpen(false)} />
      <AddVenueDialog
        open={addVenueOpen}
        onClose={() => setAddVenueOpen(false)}
        onCreated={(id) => { setVenueId(id); setUsePublisherVenue(false); setAddVenueOpen(false) }}
      />
    </>
  )
}
