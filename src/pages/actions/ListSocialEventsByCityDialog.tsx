import { useEffect, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { Checkbox } from '../../components/ui/Checkbox'
import { apiClient } from '../../api/client'

interface Props {
  open: boolean
  onClose: () => void
}

type SocialEventItem = {
  id: string
  name: string
  image_url: string | null
  instagram_account: string | null
}

type CityGroup = {
  city: string
  social_events: SocialEventItem[]
}

function toIsoDate(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function ListSocialEventsByCityDialog({ open, onClose }: Props) {
  const today = toIsoDate(new Date())
  const [day, setDay] = useState<string>(today)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [cities, setCities] = useState<CityGroup[]>([])
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set())
  const [durationSeconds, setDurationSeconds] = useState<number>(8)
  const [videoFileName, setVideoFileName] = useState(`social-events-${today}.mp4`)
  const [videoStatus, setVideoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [videoError, setVideoError] = useState('')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoMimeType, setVideoMimeType] = useState<string | null>(null)
  const [downloadFeedback, setDownloadFeedback] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')

  const totalEvents = useMemo(() => cities.reduce((acc, g) => acc + g.social_events.length, 0), [cities])

  const eventsWithImage = useMemo(
    () => cities.flatMap((g) => g.social_events).filter((e) => selectedIds.has(e.id) && Boolean(e.image_url)),
    [cities, selectedIds]
  )

  const uniqueAccounts = useMemo(() => {
    const accounts = cities
      .flatMap((g) => g.social_events)
      .filter((e) => selectedIds.has(e.id))
      .map((e) => (e.instagram_account ?? '').trim())
      .filter((a) => a.length > 0)
    return Array.from(new Set(accounts))
  }, [cities, selectedIds])

  const normalizedFileName = useMemo(() => {
    const ext = videoMimeType?.includes('webm') ? '.webm' : '.mp4'
    const cleaned = videoFileName.trim()
    if (!cleaned) return `social-events-${day}${ext}`
    if (cleaned.toLowerCase().endsWith('.webm') || cleaned.toLowerCase().endsWith('.mp4')) return cleaned
    return `${cleaned}${ext}`
  }, [videoFileName, day, videoMimeType])

  const fetchEvents = async (targetDay: string) => {
    setStatus('loading')
    setError('')
    try {
      const res = await apiClient.get<{ cities: CityGroup[] }>(
        `social-events/by-city?${new URLSearchParams({ day: targetDay })}`
      )
      setCities(res.cities ?? [])
      setStatus('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
      setCities([])
      setStatus('error')
    }
  }

  useEffect(() => {
    if (open) void fetchEvents(day)
  }, [open])

  useEffect(() => {
    return () => { if (videoUrl) URL.revokeObjectURL(videoUrl) }
  }, [videoUrl])

  const toggleEvent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const isCityFullySelected = (ids: string[]) => ids.length > 0 && ids.every((id) => selectedIds.has(id))
  const isCityPartiallySelected = (ids: string[]) =>
    ids.some((id) => selectedIds.has(id)) && !isCityFullySelected(ids)

  const toggleCity = (ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const full = ids.length > 0 && ids.every((id) => next.has(id))
      if (full) ids.forEach((id) => next.delete(id)); else ids.forEach((id) => next.add(id))
      return next
    })
  }

  const toggleCityExpand = (city: string) => {
    setExpandedCities((prev) => {
      const next = new Set(prev)
      if (next.has(city)) next.delete(city); else next.add(city)
      return next
    })
  }

  const handleGenerateVideo = async () => {
    if (eventsWithImage.length === 0) {
      setVideoStatus('error')
      setVideoError('No selected events with image URL.')
      return
    }
    setVideoStatus('loading')
    setVideoError('')

    const fps = 30
    const width = 1080
    const height = 1920
    const totalMs = Math.max(durationSeconds * 1000, 500)
    const imageDurationMs = totalMs / eventsWithImage.length
    const holdMs = imageDurationMs * 0.75
    const fadeMs = imageDurationMs * 0.25

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) { setVideoStatus('error'); setVideoError('Could not initialize canvas context.'); return }

    try {
      const bitmaps = await Promise.all(
        eventsWithImage.map(async (e) => {
          const r = await fetch(e.image_url as string)
          if (!r.ok) throw new Error(`Failed loading image for event ${e.id}`)
          return createImageBitmap(await r.blob())
        })
      )
      const sampleCanvas = document.createElement('canvas')
      sampleCanvas.width = 24
      sampleCanvas.height = 24
      const sampleCtx = sampleCanvas.getContext('2d')!
      const extractAvgRgb = (bm: ImageBitmap): [number, number, number] => {
        sampleCtx.clearRect(0, 0, 24, 24)
        sampleCtx.drawImage(bm, 0, 0, 24, 24)
        const d = sampleCtx.getImageData(0, 0, 24, 24).data
        let r = 0, g = 0, b = 0, count = 0
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] === 0) continue
          r += d[i]; g += d[i + 1]; b += d[i + 2]; count++
        }
        if (count === 0) return [17, 17, 17]
        return [Math.round(r / count), Math.round(g / count), Math.round(b / count)]
      }
      const entries = bitmaps.map((bm) => ({ bitmap: bm, bgRgb: extractAvgRgb(bm) }))

      const stream = canvas.captureStream(fps)
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm'
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve() })
      recorder.start()

      const frameDelay = 1000 / fps
      const startMs = performance.now()

      const drawContain = (bm: ImageBitmap, alpha: number) => {
        const scale = Math.min(width / bm.width, height / bm.height)
        const dw = bm.width * scale, dh = bm.height * scale
        const dx = (width - dw) / 2, dy = (height - dh) / 2
        ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(bm, dx, dy, dw, dh); ctx.restore()
      }
      const blendRgb = (
        a: [number, number, number],
        b: [number, number, number],
        t: number
      ): [number, number, number] => {
        const mix = Math.min(Math.max(t, 0), 1)
        return [
          Math.round(a[0] + (b[0] - a[0]) * mix),
          Math.round(a[1] + (b[1] - a[1]) * mix),
          Math.round(a[2] + (b[2] - a[2]) * mix),
        ]
      }

      let elapsed = 0
      while (elapsed < totalMs) {
        elapsed = performance.now() - startMs
        const safe = Math.min(elapsed, totalMs)
        const segI = Math.min(Math.floor(safe / imageDurationMs), bitmaps.length - 1)
        const segT = safe - segI * imageDurationMs
        let bgRgb = entries[segI].bgRgb
        if (segT > holdMs && segI < entries.length - 1 && fadeMs > 0) {
          bgRgb = blendRgb(bgRgb, entries[segI + 1].bgRgb, Math.min((segT - holdMs) / fadeMs, 1))
        }
        ctx.fillStyle = `rgb(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]})`
        ctx.fillRect(0, 0, width, height)
        drawContain(entries[segI].bitmap, 1)
        if (segT > holdMs && segI < entries.length - 1 && fadeMs > 0) {
          drawContain(entries[segI + 1].bitmap, Math.min((segT - holdMs) / fadeMs, 1))
        }
        await new Promise((resolve) => setTimeout(resolve, frameDelay))
      }

      recorder.stop()
      await stopped
      stream.getTracks().forEach((t) => t.stop())
      entries.forEach((e) => e.bitmap.close())

      const blob = new Blob(chunks, { type: mimeType })
      if (videoUrl) URL.revokeObjectURL(videoUrl)
      setVideoUrl(URL.createObjectURL(blob))
      setVideoMimeType(mimeType)
      setVideoStatus('success')
    } catch (e) {
      setVideoStatus('error')
      setVideoError(e instanceof Error ? e.message : 'Failed to generate video. Check image CORS and retry.')
    }
  }

  const handleDownload = async () => {
    if (!videoUrl) return
    setDownloadFeedback('')
    if (navigator.canShare && navigator.share && videoMimeType) {
      try {
        const r = await fetch(videoUrl)
        const blob = await r.blob()
        const file = new File([blob], normalizedFileName, { type: videoMimeType })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: normalizedFileName, files: [file] })
          setDownloadFeedback('Video shared/saved successfully.')
          return
        }
      } catch {}
    }
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = normalizedFileName
    a.click()
    setDownloadFeedback('Download started.')
  }

  const copyText = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text); setCopyFeedback(msg) }
    catch { setCopyFeedback('Could not copy to clipboard.') }
  }

  const handleClose = () => {
    setStatus('idle')
    setError('')
    setCities([])
    setPreviewImage(null)
    setSelectedIds(new Set())
    setExpandedCities(new Set())
    setDurationSeconds(8)
    setVideoFileName(`social-events-${toIsoDate(new Date())}.mp4`)
    setVideoStatus('idle')
    setVideoError('')
    setVideoMimeType(null)
    setDownloadFeedback('')
    setCopyFeedback('')
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Events by city"
        size="xl"
        footer={<Button variant="secondary" onClick={handleClose}>Close</Button>}
      >
        <div className="flex flex-col gap-5">
          {/* Controls */}
          <div className="flex flex-wrap gap-3 items-end">
            <Input
              label="Day"
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-44"
            />
            <Button
              onClick={() => void fetchEvents(day)}
              loading={status === 'loading'}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Loading…' : 'Load events'}
            </Button>
            <span className="text-xs text-text/50 self-center pb-0.5">
              {totalEvents} events / {cities.length} cities · {selectedIds.size} selected
            </span>
          </div>

          {status === 'error' && <Alert variant="critical">{error}</Alert>}
          {status === 'success' && cities.length === 0 && (
            <Alert variant="info">No social events found for the selected day.</Alert>
          )}

          {/* City groups */}
          {status === 'success' && cities.length > 0 && (
            <div className="flex flex-col gap-2">
              {cities.map((group) => {
                const ids = group.social_events.map((e) => e.id)
                const expanded = expandedCities.has(group.city)
                const fullySelected = isCityFullySelected(ids)
                const partiallySelected = isCityPartiallySelected(ids)
                return (
                  <div key={group.city} className="rounded-xl border border-text/10 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-raised">
                      <button
                        type="button"
                        onClick={() => toggleCity(ids)}
                        className="flex-shrink-0"
                        aria-label={`Toggle all events in ${group.city}`}
                      >
                        <Checkbox
                          checked={fullySelected}
                          indeterminate={partiallySelected}
                          readOnly
                          className="pointer-events-none"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCityExpand(group.city)}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        <span className="text-sm font-semibold text-text">{group.city}</span>
                        <span className="text-xs text-text/50">({group.social_events.length})</span>
                        <span className="ml-auto text-text/40 text-xs">{expanded ? '▲' : '▼'}</span>
                      </button>
                    </div>
                    {expanded && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-base">
                        {group.social_events.map((evt) => (
                          <div key={evt.id} className="rounded-lg border border-text/10 overflow-hidden bg-raised">
                            {evt.image_url ? (
                              <div className="relative">
                                <img
                                  src={evt.image_url}
                                  alt={evt.name}
                                  className="w-full h-36 object-cover cursor-zoom-in"
                                  onClick={() => setPreviewImage({ url: evt.image_url as string, title: evt.name })}
                                />
                                <button
                                  type="button"
                                  onClick={() => toggleEvent(evt.id)}
                                  className={`absolute top-2 right-2 size-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                    selectedIds.has(evt.id)
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-black/60 text-white hover:bg-black/80'
                                  }`}
                                  aria-label={selectedIds.has(evt.id) ? `Deselect ${evt.name}` : `Select ${evt.name}`}
                                >
                                  {selectedIds.has(evt.id) ? '✓' : '○'}
                                </button>
                              </div>
                            ) : (
                              <div className="h-36 flex items-center justify-center bg-overlay text-text/30 text-xs">
                                No image
                              </div>
                            )}
                            <div className="px-2.5 py-2">
                              <p className="text-xs font-medium text-text truncate">{evt.name}</p>
                              <p className="text-xs text-text/40 truncate">{evt.id}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Video generation panel */}
          {status === 'success' && (
            <div className="rounded-xl border border-text/10 bg-raised p-4 flex flex-col gap-4">
              <p className="text-sm font-semibold text-text">Generate video from selected events</p>
              <div className="flex flex-wrap gap-3 items-end">
                <Input
                  label="Duration (seconds)"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  className="w-40"
                />
                <Input
                  label="File name"
                  value={videoFileName}
                  onChange={(e) => setVideoFileName(e.target.value)}
                  className="w-56"
                />
                <Button
                  onClick={() => void handleGenerateVideo()}
                  loading={videoStatus === 'loading'}
                  disabled={
                    selectedIds.size === 0 ||
                    durationSeconds <= 0 ||
                    videoStatus === 'loading' ||
                    eventsWithImage.length === 0
                  }
                >
                  {videoStatus === 'loading' ? 'Generating…' : 'Generate locally'}
                </Button>
                <span className="text-xs text-text/50 self-center pb-0.5">
                  {selectedIds.size} selected ({eventsWithImage.length} with image)
                </span>
              </div>

              {/* Instagram accounts */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-text">Instagram accounts (unique)</span>
                  <button
                    type="button"
                    onClick={() => void copyText(uniqueAccounts.join('\n'), `Copied ${uniqueAccounts.length} account(s).`)}
                    disabled={uniqueAccounts.length === 0}
                    className="flex items-center justify-center size-6 rounded text-text/40 hover:text-text hover:bg-overlay disabled:opacity-30 transition-colors"
                    title="Copy all"
                  >
                    <Copy size={12} />
                  </button>
                  <span className="text-xs text-text/40">{uniqueAccounts.length}</span>
                </div>
                {uniqueAccounts.length === 0
                  ? <p className="text-xs text-text/40">No Instagram accounts for selected events.</p>
                  : (
                    <div className="flex flex-col gap-1">
                      {uniqueAccounts.map((a) => (
                        <div key={a} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-text">{a}</span>
                          <button
                            type="button"
                            onClick={() => void copyText(a, `Copied: ${a}`)}
                            className="flex items-center justify-center size-6 rounded text-text/40 hover:text-text hover:bg-overlay transition-colors"
                            title={`Copy ${a}`}
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                }
                {copyFeedback && <p className="text-xs text-text/50 mt-1">{copyFeedback}</p>}
              </div>

              {videoStatus === 'error' && <Alert variant="critical">{videoError}</Alert>}

              {videoStatus === 'success' && videoUrl && (
                <div className="flex flex-col gap-2">
                  <video controls src={videoUrl} className="w-full max-h-96 rounded-lg bg-black" />
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-text/50">Download as: {normalizedFileName}</span>
                    <Button size="sm" variant="secondary" onClick={() => void handleDownload()}>
                      Download video
                    </Button>
                  </div>
                  {downloadFeedback && <p className="text-xs text-text/50">{downloadFeedback}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {previewImage && (
        <Modal
          open={!!previewImage}
          onClose={() => setPreviewImage(null)}
          title={previewImage.title}
          size="xl"
          footer={<Button variant="secondary" onClick={() => setPreviewImage(null)}>Close</Button>}
        >
          <div className="flex justify-center bg-black rounded-lg overflow-hidden">
            <img
              src={previewImage.url}
              alt={previewImage.title}
              className="max-w-full max-h-[75vh] object-contain"
            />
          </div>
        </Modal>
      )}
    </>
  )
}
