import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { apiClient } from '../../api/client'

interface Props {
  open: boolean
  onClose: () => void
}

type InstagramAccountRecord = { id: string; account: string | null }

export function RunScraperByAccountDialog({ open, onClose }: Props) {
  const [accountId, setAccountId] = useState('')
  const [days, setDays] = useState<string>('1')
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const [searchOpen, setSearchOpen] = useState(false)
  const [q, setQ] = useState('')
  const [candidates, setCandidates] = useState<InstagramAccountRecord[]>([])
  const [searching, setSearching] = useState(false)

  const doSearch = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (trimmed.length < 2) { setCandidates([]); return }
    setSearching(true)
    try {
      const params = new URLSearchParams({ limit: '20', offset: '0', order_by: 'id', order_dir: 'desc' })
      params.append('account__icontains', trimmed)
      const res = await apiClient.get<{ items: InstagramAccountRecord[] }>(
        `/crud/instagram_accounts/search?${params}`
      )
      setCandidates(Array.isArray(res.items) ? res.items : [])
    } catch { setCandidates([]) }
    finally { setSearching(false) }
  }, [])

  useEffect(() => {
    if (!searchOpen) return
    const t = setTimeout(() => doSearch(q), 300)
    return () => clearTimeout(t)
  }, [q, searchOpen, doSearch])

  const handleTrigger = async () => {
    const trimmedId = accountId.trim()
    if (!trimmedId) {
      setStatus('error')
      setMessage('Instagram account ID is required.')
      return
    }
    const daysNum = days.trim() === '' ? null : Number(days)
    if (daysNum === null || Number.isNaN(daysNum) || daysNum < 0) {
      setStatus('error')
      setMessage('Days must be 0 or greater.')
      return
    }
    setStatus('running')
    setMessage('')
    try {
      const params = new URLSearchParams({
        instagram_account_id: trimmedId,
        only_posts_newer_than_days: String(daysNum),
      })
      const res = await apiClient.post<{ task_id: string }>(
        `scraping/run-scraper-by-instagram-account-id?${params}`
      )
      setStatus('success')
      setMessage(`Scraper started for selected account (task_id: ${res.task_id}).`)
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : 'Request failed')
    }
  }

  const handleClose = () => {
    setAccountId('')
    setDays('1')
    setStatus('idle')
    setMessage('')
    setSearchOpen(false)
    setQ('')
    setCandidates([])
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Run scraper by account"
        footer={
          <>
            <Button variant="secondary" onClick={handleClose}>Close</Button>
            <Button
              onClick={handleTrigger}
              loading={status === 'running'}
              disabled={status === 'running' || !accountId.trim() || days.trim() === ''}
            >
              {status === 'running' ? 'Starting…' : 'Run scraper'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text/60">
            Starts scraping for one Instagram account. Use the search button to find an account by username.
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Instagram account ID"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="Account ID"
                required
              />
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="mt-6 flex size-10 shrink-0 items-center justify-center rounded-lg border border-text/15 bg-raised text-text/60 hover:bg-overlay hover:text-text transition-colors"
              title="Search Instagram account"
            >
              <Search size={16} />
            </button>
          </div>
          <Input
            label="Only posts newer than (days)"
            type="number"
            min={0}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            required
          />
          {status === 'success' && <Alert variant="good">{message}</Alert>}
          {status === 'error' && <Alert variant="critical">{message}</Alert>}
        </div>
      </Modal>

      <Modal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Search Instagram account"
        size="sm"
        footer={<Button variant="secondary" onClick={() => setSearchOpen(false)}>Close</Button>}
      >
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Type at least 2 characters..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {searching && <div className="flex justify-center py-2"><Spinner /></div>}
          <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
            {candidates.map((c) => (
              <button
                key={c.id}
                onClick={() => { setAccountId(c.id); setSearchOpen(false); setQ(''); setCandidates([]) }}
                className="text-left px-3 py-2 rounded-lg hover:bg-overlay transition-colors"
              >
                <div className="text-sm font-medium text-text">@{c.account || '-'}</div>
                <div className="text-xs text-text/50">{c.id}</div>
              </button>
            ))}
            {!searching && candidates.length === 0 && q.trim().length >= 2 && (
              <p className="text-sm text-text/50 text-center py-3">No results found</p>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
