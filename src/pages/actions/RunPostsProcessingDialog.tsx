import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { apiClient } from '../../api/client'

interface Props {
  open: boolean
  onClose: () => void
}

export function RunPostsProcessingDialog({ open, onClose }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleTrigger = async () => {
    setStatus('running')
    setMessage('')
    try {
      await apiClient.post('scraping/run-posts-processing')
      setStatus('success')
      setMessage('Posts processing started in the background.')
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
      title="Run posts processing"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Close</Button>
          <Button onClick={handleTrigger} loading={status === 'running'} disabled={status === 'running'}>
            {status === 'running' ? 'Starting…' : 'Run posts processing'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text/60">
          Starts the pipeline that generates social events from imported Instagram posts. Runs in the background and returns immediately.
        </p>
        {status === 'success' && <Alert variant="good">{message}</Alert>}
        {status === 'error' && <Alert variant="critical">{message}</Alert>}
      </div>
    </Modal>
  )
}
