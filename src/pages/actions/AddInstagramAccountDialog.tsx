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

export function AddInstagramAccountDialog({ open, onClose, onCreated }: Props) {
  const [account, setAccount] = useState('')
  const [scrapePosts, setScrapePosts] = useState(true)
  const [scrapeReels, setScrapeReels] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    if (!account.trim()) {
      setMessage('Account is required.')
      setStatus('error')
      return
    }
    setStatus('submitting')
    setMessage('')
    try {
      const res = await apiClient.post<{ id?: string; instagram_account?: { id?: string } }>(
        `instagram-accounts/?${new URLSearchParams({
          account: account.trim(),
          scrape_posts: String(scrapePosts),
          scrape_reels: String(scrapeReels),
          is_active: String(isActive),
        })}`
      )
      const createdId = res?.id ?? res?.instagram_account?.id ?? ''
      setStatus('success')
      setMessage('Instagram account created successfully.')
      if (createdId) onCreated?.(createdId)
      setAccount('')
      setScrapePosts(true)
      setScrapeReels(true)
      setIsActive(true)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to create Instagram account')
      setStatus('error')
    }
  }

  const handleClose = () => {
    setAccount('')
    setScrapePosts(true)
    setScrapeReels(true)
    setIsActive(true)
    setStatus('idle')
    setMessage('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add Instagram account"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            loading={status === 'submitting'}
            disabled={status === 'submitting' || !account.trim()}
          >
            {status === 'submitting' ? 'Creating…' : 'Create Instagram account'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text/60">
          Create an Instagram account record for scraping and publisher linking.
        </p>
        <Input
          label="Account"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="username (without @)"
          required
        />
        <Toggle checked={scrapePosts} onChange={setScrapePosts} label="Scrape posts" />
        <Toggle checked={scrapeReels} onChange={setScrapeReels} label="Scrape reels" />
        <Toggle checked={isActive} onChange={setIsActive} label="Active" />
        {status === 'success' && <Alert variant="good">{message}</Alert>}
        {status === 'error' && <Alert variant="critical">{message}</Alert>}
      </div>
    </Modal>
  )
}
