import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { apiClient } from '../../api/client'

interface Props {
  open: boolean
  onClose: () => void
}

export function RunScraperDialog({ open, onClose }: Props) {
  const [days, setDays] = useState<string>('1')
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleTrigger = async () => {
    setStatus('running')
    setMessage('')
    try {
      const path =
        days.trim() === ''
          ? 'scraping/run-scraper'
          : `scraping/run-scraper?only_posts_newer_than_days=${encodeURIComponent(days.trim())}`
      await apiClient.post(path)
      setStatus('success')
      setMessage('Scraper run started in the background.')
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : 'Request failed')
    }
  }

  const handleClose = () => {
    setDays('1')
    setStatus('idle')
    setMessage('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Run scraper"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Close</Button>
          <Button onClick={handleTrigger} loading={status === 'running'} disabled={status === 'running'}>
            {status === 'running' ? 'Starting…' : 'Run scraper'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text/60">
          Triggers the backend scraper job. Runs in the background and returns immediately.
        </p>
        <Input
          label="Only posts newer than (days)"
          type="number"
          min={0}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="Leave empty to use backend default"
        />
        <p className="text-xs text-text/40 -mt-2">Leave empty to use the backend default.</p>
        {status === 'success' && <Alert variant="good">{message}</Alert>}
        {status === 'error' && <Alert variant="critical">{message}</Alert>}
      </div>
    </Modal>
  )
}
