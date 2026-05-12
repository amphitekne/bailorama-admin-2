import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { Checkbox } from '../../components/ui/Checkbox'
import { Toggle } from '../../components/ui/Toggle'
import { Select } from '../../components/ui/Select'
import { Alert } from '../../components/ui/Alert'
import { apiClient } from '../../api/client'

interface Props {
  open: boolean
  onClose: () => void
}

type DanceType = 'salsa' | 'bachata' | 'kizomba' | 'other'
type SelectionStatus = 'pending' | 'selected' | 'suppressed' | 'pending_review'
type SuppressReason = '' | 'date_collision' | 'duplicate_source' | 'manual'

type SocialEventResponse = {
  id: string
  slug: string
  name: string
  description: string
  dance_types: DanceType[]
  image_url: string | null
  starts_at: string
  instagram_post_url: string | null
  location?: { formatted_address?: string | null } | null
}

type SocialEventsSearchResponse = {
  social_events: SocialEventResponse[]
  next_cursor: string | null
  has_more: boolean
}

type SocialEventCrudRecord = {
  publisher_id: string
  venue_id: string | null
  location_id: string
  event_source: string
  is_active: boolean
  is_deleted: boolean
  is_banned: boolean
  selection_status: SelectionStatus
  suppress_reason: Exclude<SuppressReason, ''> | null
  review_comment: string | null
}

const DANCE_TYPE_OPTIONS: DanceType[] = ['salsa', 'bachata', 'kizomba', 'other']

const SELECTION_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'selected', label: 'Selected' },
  { value: 'suppressed', label: 'Suppressed' },
  { value: 'pending_review', label: 'Pending review' },
]

const SUPPRESS_REASON_OPTIONS = [
  { value: 'date_collision', label: 'Date collision' },
  { value: 'duplicate_source', label: 'Duplicate source' },
  { value: 'manual', label: 'Manual' },
]

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function toUtcIso(localDateTime: string): string {
  return new Date(localDateTime).toISOString()
}

function toIsoDate(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function EditSocialEventDialog({ open, onClose }: Props) {
  const today = toIsoDate(new Date())
  const [lookup, setLookup] = useState('')
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle')
  const [lookupError, setLookupError] = useState('')
  const [loadedEventId, setLoadedEventId] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [danceTypes, setDanceTypes] = useState<DanceType[]>([])
  const [publisherId, setPublisherId] = useState('')
  const [venueId, setVenueId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [postUrl, setPostUrl] = useState('')
  const [image, setImage] = useState<File | null>(null)

  const [isActive, setIsActive] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)
  const [isBanned, setIsBanned] = useState(false)
  const [selectionStatus, setSelectionStatus] = useState<SelectionStatus>('pending')
  const [suppressReason, setSuppressReason] = useState<SuppressReason>('')
  const [reviewComment, setReviewComment] = useState('')

  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [submitMessage, setSubmitMessage] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchStartDate, setSearchStartDate] = useState(today)
  const [searchEndDate, setSearchEndDate] = useState('')
  const [searchResults, setSearchResults] = useState<SocialEventResponse[]>([])
  const [searchNextCursor, setSearchNextCursor] = useState<string | null>(null)
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [searchError, setSearchError] = useState('')

  const hasLoaded = loadedEventId.length > 0
  const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleLoad = async (candidate?: string) => {
    const value = (candidate ?? lookup).trim()
    if (!value) return
    setLookup(value)
    setLookupStatus('loading')
    setLookupError('')
    try {
      const event = await apiClient.get<SocialEventResponse>(`social-events/${encodeURIComponent(value)}`)
      const crud = await apiClient.get<SocialEventCrudRecord>(`/crud/social_events/${encodeURIComponent(event.id)}`)
      setLoadedEventId(event.id)
      setName(event.name)
      setDescription(event.description)
      setStartsAt(toLocalDateTimeInput(event.starts_at))
      setDanceTypes(event.dance_types ?? [])
      setPublisherId(crud.publisher_id)
      setVenueId(crud.venue_id ?? '')
      setLocationId(crud.location_id)
      setPostUrl(crud.event_source || event.instagram_post_url || '')
      setIsActive(Boolean(crud.is_active))
      setIsDeleted(Boolean(crud.is_deleted))
      setIsBanned(Boolean(crud.is_banned))
      setSelectionStatus(crud.selection_status)
      setSuppressReason(crud.suppress_reason ?? '')
      setReviewComment(crud.review_comment ?? '')
      setLookupStatus('success')
      setSubmitStatus('idle')
      setSubmitMessage('')
    } catch (e) {
      setLookupStatus('error')
      setLookupError(e instanceof Error ? e.message : 'Failed to load event')
    }
  }

  const fetchSearch = async (cursor?: string) => {
    setSearchStatus('loading')
    setSearchError('')
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (cursor) params.append('cursor', cursor)
      if (searchStartDate) params.append('start_date', `${searchStartDate}T00:00:00Z`)
      if (searchEndDate) params.append('end_date', `${searchEndDate}T23:59:59Z`)
      const res = await apiClient.get<SocialEventsSearchResponse>(`social-events/search?${params.toString()}`)
      const incoming = Array.isArray(res.social_events) ? res.social_events : []
      const q = searchQuery.trim().toLowerCase()
      const filtered = q.length === 0
        ? incoming
        : incoming.filter((event) => {
            const haystack = `${event.name} ${event.description} ${event.slug}`.toLowerCase()
            return haystack.includes(q)
          })
      setSearchResults((prev) => (cursor ? [...prev, ...filtered] : filtered))
      setSearchNextCursor(res.next_cursor ?? null)
      setSearchStatus('idle')
    } catch (e) {
      setSearchStatus('error')
      setSearchError(e instanceof Error ? e.message : 'Failed to search social events')
    }
  }

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      void fetchSearch()
    }, 300)
    return () => clearTimeout(t)
  }, [open, searchQuery, searchStartDate, searchEndDate])

  const toggleDanceType = (dt: DanceType) => {
    setDanceTypes((prev) => (prev.includes(dt) ? prev.filter((item) => item !== dt) : [...prev, dt]))
  }

  const handleSubmit = async () => {
    if (!loadedEventId) return
    setSubmitStatus('sending')
    setSubmitMessage('')
    try {
      const form = new FormData()
      form.append('name', name.trim())
      form.append('description', description.trim())
      if (startsAt.trim()) form.append('starts_at', toUtcIso(startsAt.trim()))
      danceTypes.forEach((dt) => form.append('dance_types', dt))
      form.append('publisher_id', publisherId.trim())
      form.append('venue_id', venueId.trim())
      form.append('location_id', locationId.trim())
      form.append('post_url', postUrl.trim())
      form.append('is_active', String(isActive))
      form.append('is_deleted', String(isDeleted))
      form.append('is_banned', String(isBanned))
      form.append('selection_status', selectionStatus)
      if (suppressReason) form.append('suppress_reason', suppressReason)
      form.append('review_comment', reviewComment)
      if (image) form.append('image', image)

      await apiClient.patch(`social-events/${encodeURIComponent(loadedEventId)}/admin-edit`, form)
      setSubmitStatus('success')
      setSubmitMessage('Social event updated successfully.')
    } catch (e) {
      setSubmitStatus('error')
      setSubmitMessage(e instanceof Error ? e.message : 'Failed to update social event')
    }
  }

  const resetAndClose = () => {
    setLookup('')
    setLookupStatus('idle')
    setLookupError('')
    setLoadedEventId('')
    setName('')
    setDescription('')
    setStartsAt('')
    setDanceTypes([])
    setPublisherId('')
    setVenueId('')
    setLocationId('')
    setPostUrl('')
    setImage(null)
    setIsActive(false)
    setIsDeleted(false)
    setIsBanned(false)
    setSelectionStatus('pending')
    setSuppressReason('')
    setReviewComment('')
    setSubmitStatus('idle')
    setSubmitMessage('')
    setSearchQuery('')
    setSearchStartDate(today)
    setSearchEndDate('')
    setSearchResults([])
    setSearchNextCursor(null)
    setSearchStatus('idle')
    setSearchError('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Edit social event"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={resetAndClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitStatus === 'sending'} disabled={!hasLoaded || submitStatus === 'sending'}>
            {submitStatus === 'sending' ? 'Saving...' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text/60">Load an event by ID or slug, edit fields and moderation flags, and optionally replace the image.</p>

        <div className="rounded-lg border border-text/10 bg-raised/40 p-3">
          <p className="text-sm font-medium text-text mb-2">Search social events</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input
              label="Text filter"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="name, description, slug"
            />
            <Input
              label="Start date"
              type="date"
              value={searchStartDate}
              onChange={(e) => setSearchStartDate(e.target.value)}
            />
            <Input
              label="End date (optional)"
              type="date"
              value={searchEndDate}
              onChange={(e) => setSearchEndDate(e.target.value)}
            />
          </div>

          {searchStatus === 'error' && <Alert variant="critical" className="mt-2">{searchError}</Alert>}

          <div className="mt-3 flex flex-col gap-2">
            {searchResults.length === 0 && searchStatus !== 'loading' && (
              <p className="text-xs text-text/60">No events found with current filters.</p>
            )}
            {searchResults.map((event) => (
              <div key={event.id} className="flex items-start justify-between gap-3 rounded-md border border-text/10 bg-raised p-2">
                <div className="flex min-w-0 items-start gap-2">
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.name}
                      className="h-12 w-12 shrink-0 rounded-md border border-text/10 object-cover bg-overlay"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-text/10 bg-overlay text-[10px] text-text/40">
                      No img
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">{event.name}</p>
                    <p className="text-xs text-text/60 truncate">{new Date(event.starts_at).toLocaleString()} - {event.slug}</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void handleLoad(event.id)}
                  loading={lookupStatus === 'loading' && lookup === event.id}
                  disabled={lookupStatus === 'loading'}
                >
                  Select
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => void fetchSearch()} loading={searchStatus === 'loading'}>
                Refresh
              </Button>
              {searchNextCursor && (
                <Button
                  variant="secondary"
                  onClick={() => void fetchSearch(searchNextCursor)}
                  loading={searchStatus === 'loading'}
                >
                  Load more
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <Input label="Event ID or slug" value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="event id or slug" />
          <Button onClick={() => void handleLoad()} loading={lookupStatus === 'loading'} disabled={!lookup.trim() || lookupStatus === 'loading'}>
            {lookupStatus === 'loading' ? 'Loading...' : 'Load event'}
          </Button>
        </div>

        {lookupStatus === 'error' && <Alert variant="critical">{lookupError}</Alert>}
        {submitStatus === 'success' && <Alert variant="good">{submitMessage}</Alert>}
        {submitStatus === 'error' && <Alert variant="critical">{submitMessage}</Alert>}

        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} disabled={!hasLoaded} />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={!hasLoaded} />
        <Input label="Starts at" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} disabled={!hasLoaded} />

        <fieldset>
          <legend className="text-sm font-medium text-text mb-2">Dance types</legend>
          <div className="flex flex-wrap gap-4">
            {DANCE_TYPE_OPTIONS.map((dt) => (
              <label key={dt} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={danceTypes.includes(dt)} onChange={() => toggleDanceType(dt)} disabled={!hasLoaded} />
                <span className="text-sm text-text capitalize">{dt}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Input label="Publisher ID" value={publisherId} onChange={(e) => setPublisherId(e.target.value)} disabled={!hasLoaded} />
        <Input label="Venue ID" value={venueId} onChange={(e) => setVenueId(e.target.value)} disabled={!hasLoaded} />
        <Input label="Location ID" value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={!hasLoaded} />
        <Input label="Instagram post URL" value={postUrl} onChange={(e) => setPostUrl(e.target.value)} disabled={!hasLoaded} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Toggle checked={isActive} onChange={setIsActive} label="is_active" disabled={!hasLoaded} />
          <Toggle checked={isDeleted} onChange={setIsDeleted} label="is_deleted" disabled={!hasLoaded} />
          <Toggle checked={isBanned} onChange={setIsBanned} label="is_banned" disabled={!hasLoaded} />
        </div>

        <Select
          label="Selection status"
          value={selectionStatus}
          onChange={(e) => setSelectionStatus(e.target.value as SelectionStatus)}
          options={SELECTION_STATUS_OPTIONS}
          disabled={!hasLoaded}
        />

        <Select
          label="Suppress reason"
          value={suppressReason}
          onChange={(e) => setSuppressReason(e.target.value as SuppressReason)}
          options={SUPPRESS_REASON_OPTIONS}
          placeholder="No suppress reason"
          disabled={!hasLoaded}
        />

        <Textarea
          label="Review comment"
          value={reviewComment}
          onChange={(e) => setReviewComment(e.target.value)}
          disabled={!hasLoaded}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">New image (optional)</label>
          <label className="cursor-pointer">
            <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-text/15 bg-raised px-4 text-sm text-text hover:bg-overlay transition-colors">
              {image ? image.name : 'Upload image'}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="sr-only"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              disabled={!hasLoaded}
            />
          </label>
        </div>

        {previewUrl && (
          <div className="border border-text/10 rounded-lg overflow-hidden max-h-48 flex justify-center bg-overlay">
            <img src={previewUrl} alt="New image preview" className="max-w-full max-h-48 object-contain" />
          </div>
        )}
      </div>
    </Modal>
  )
}
