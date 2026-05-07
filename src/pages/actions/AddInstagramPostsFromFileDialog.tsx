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

export function AddInstagramPostsFromFileDialog({ open, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [days, setDays] = useState<string>('1')
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setStatus('idle')
    setMessage('')
  }

  const handleUpload = async () => {
    if (!file) return
    setStatus('uploading')
    setMessage('')
    try {
      const form = new FormData()
      form.append('json_file', file)
      const path =
        days.trim() === ''
          ? 'scraping/add-instagram-posts-from-file'
          : `scraping/add-instagram-posts-from-file?only_posts_newer_than_days=${encodeURIComponent(days.trim())}`
      const res = await apiClient.post<{ n_added_posts: number }>(path, form)
      setStatus('success')
      setMessage(`${res.n_added_posts} post(s) added successfully.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Upload failed')
      setStatus('error')
    }
  }

  const handleClose = () => {
    setFile(null)
    setDays('1')
    setStatus('idle')
    setMessage('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add posts from file"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleUpload}
            loading={status === 'uploading'}
            disabled={status === 'uploading' || !file}
          >
            {status === 'uploading' ? 'Uploading…' : 'Upload and add posts'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text/60">
          Upload a JSON file with Apify Instagram scraper output. Posts will be imported and linked to venues.
        </p>
        <Input
          label="Only posts newer than (days)"
          type="number"
          min={0}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="Leave empty for backend default"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">JSON file</label>
          <label className="cursor-pointer">
            <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-text/15 bg-raised px-4 text-sm text-text hover:bg-overlay transition-colors cursor-pointer">
              {file ? file.name : 'Choose JSON file'}
            </span>
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
        </div>
        {status === 'success' && <Alert variant="good">{message}</Alert>}
        {status === 'error' && <Alert variant="critical">{message}</Alert>}
      </div>
    </Modal>
  )
}
