import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Toggle } from '../../components/ui/Toggle'
import { Alert } from '../../components/ui/Alert'
import { apiClient } from '../../api/client'

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

export function AddVenueDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [mapsUrl, setMapsUrl] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) {
      setMessage('Name is required.')
      setStatus('error')
      return
    }
    setStatus('submitting')
    setMessage('')
    try {
      const res = await apiClient.post<{ id?: string; venue?: { id?: string } }>('venues/', {
        name: name.trim(),
        is_active: isActive,
        maps_url: mapsUrl.trim() || null,
      })
      const createdId = res?.id ?? res?.venue?.id ?? ''
      setStatus('success')
      setMessage('Venue created successfully.')
      if (createdId) onCreated?.(createdId)
      setName('')
      setMapsUrl('')
      setIsActive(true)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to create venue')
      setStatus('error')
    }
  }

  const handleClose = () => {
    setName('')
    setMapsUrl('')
    setIsActive(true)
    setStatus('idle')
    setMessage('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add new venue"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            loading={status === 'submitting'}
            disabled={status === 'submitting' || !name.trim()}
          >
            {status === 'submitting' ? 'Creating…' : 'Create venue'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text/60">
          Create a new venue with name, optional Google Maps URL, and active status.
        </p>
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Venue name"
          required
        />
        <Input
          label="Google Maps URL (optional)"
          value={mapsUrl}
          onChange={(e) => setMapsUrl(e.target.value)}
          placeholder="https://maps.google.com/..."
        />
        <Toggle checked={isActive} onChange={setIsActive} label="Active" />
        {status === 'success' && <Alert variant="good">{message}</Alert>}
        {status === 'error' && <Alert variant="critical">{message}</Alert>}
      </div>
    </Modal>
  )
}
