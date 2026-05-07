import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { apiClient } from '../../api/client'

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

type LocationResponse = {
  location: {
    id: string
    formatted_address: string | null
    full_address: string | null
  }
}

export function AddLocationDialog({ open, onClose, onCreated }: Props) {
  const [mapsUrl, setMapsUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [responseJson, setResponseJson] = useState('')

  const handleSubmit = async () => {
    const trimmed = mapsUrl.trim()
    if (!trimmed) {
      setMessage('Google Maps URL is required.')
      setStatus('error')
      return
    }
    setStatus('submitting')
    setMessage('')
    setResponseJson('')
    try {
      const res = await apiClient.post<LocationResponse>(
        `locations/?${new URLSearchParams({ maps_url: trimmed })}`
      )
      const loc = res.location
      const label = loc.formatted_address || loc.full_address || loc.id
      setStatus('success')
      setMessage(`Location created: ${label}`)
      setResponseJson(JSON.stringify(res, null, 2))
      onCreated?.(loc.id)
      setMapsUrl('')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to create location')
      setStatus('error')
    }
  }

  const handleClose = () => {
    setMapsUrl('')
    setStatus('idle')
    setMessage('')
    setResponseJson('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add new location"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            loading={status === 'submitting'}
            disabled={status === 'submitting' || !mapsUrl.trim()}
          >
            {status === 'submitting' ? 'Creating…' : 'Create location'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text/60">
          Add a location from a Google Maps URL. The backend geocodes it and extracts address components.
        </p>
        <Input
          label="Google Maps URL"
          value={mapsUrl}
          onChange={(e) => setMapsUrl(e.target.value)}
          placeholder="https://maps.google.com/..."
          required
        />
        {status === 'success' && <Alert variant="good">{message}</Alert>}
        {status === 'error' && <Alert variant="critical">{message}</Alert>}
        {responseJson && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-text/60">Response</p>
            <pre className="text-xs font-mono bg-base border border-text/10 rounded-lg px-3.5 py-2.5 overflow-x-auto whitespace-pre-wrap break-words text-text/80">
              {responseJson}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  )
}
