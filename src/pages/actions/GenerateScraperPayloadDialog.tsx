import { useState, useEffect } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { apiClient } from '../../api/client'

interface Props {
  open: boolean
  onClose: () => void
}

export function GenerateScraperPayloadDialog({ open, onClose }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [payload, setPayload] = useState<unknown>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (open) {
      setPayload(null)
      setStatus('idle')
      setMessage('')
    }
  }, [open])

  const fetchPayload = async () => {
    setStatus('loading')
    setMessage('')
    try {
      const data = await apiClient.get<unknown>('scraping/generate-scraper-payload')
      setPayload(data)
      setStatus('success')
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : 'Failed to generate Apify input')
    }
  }

  const jsonString = payload != null ? JSON.stringify(payload, null, 2) : ''

  const handleCopy = async () => {
    if (!jsonString) return
    await navigator.clipboard.writeText(jsonString)
    setMessage('Copied to clipboard')
    setTimeout(() => setMessage(''), 2000)
  }

  const handleDownload = () => {
    if (!jsonString) return
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'apify-input.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate Apify input"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {status === 'success' && payload != null && (
            <>
              <Button variant="secondary" onClick={handleCopy}>Copy</Button>
              <Button variant="secondary" onClick={handleDownload}>Download JSON</Button>
            </>
          )}
          <Button onClick={fetchPayload} loading={status === 'loading'} disabled={status === 'loading'}>
            {status === 'loading' ? 'Generating…' : status === 'success' ? 'Regenerate' : 'Generate'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text/60">
          Fetches venues' Instagram accounts and builds the JSON payload for the Apify Instagram scraper. Use this as the run input in Apify.
        </p>

        {status === 'success' && payload != null && (
          <textarea
            readOnly
            value={jsonString}
            rows={14}
            className="w-full rounded-lg bg-base border border-text/15 px-3.5 py-2.5 text-xs font-mono text-text resize-y focus:outline-none"
          />
        )}

        {status === 'success' && message && <Alert variant="good">{message}</Alert>}
        {status === 'error' && <Alert variant="critical">{message}</Alert>}
      </div>
    </Modal>
  )
}
