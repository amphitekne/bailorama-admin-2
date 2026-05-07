import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { apiClient } from '../../api/client'

interface Props {
  open: boolean
  onClose: () => void
}

export function AutoActivateSocialEventsDialog({ open, onClose }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleTrigger = async () => {
    setStatus('running')
    setMessage('')
    try {
      await apiClient.post('scraping/auto-activate-social-events')
      setStatus('success')
      setMessage('Auto-activation started in the background.')
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : 'Request failed')
    }
  }

  const handleClose = () => {
    setStatus('idle')
    setMessage('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Auto-activate social events"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Close</Button>
          <Button onClick={handleTrigger} loading={status === 'running'} disabled={status === 'running'}>
            {status === 'running' ? 'Starting…' : 'Auto-activate'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text/60">
          Starts automatic activation of social events in the background. Use this after generating events from posts.
        </p>
        {status === 'success' && <Alert variant="good">{message}</Alert>}
        {status === 'error' && <Alert variant="critical">{message}</Alert>}
      </div>
    </Modal>
  )
}
