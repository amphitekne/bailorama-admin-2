import { useCallback, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { Copy, Download, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { Checkbox } from '../../components/ui/Checkbox'
import { apiClient } from '../../api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type DanceType = 'salsa' | 'bachata' | 'kizomba' | 'other'

type SocialEvent = {
  id: string
  name: string
  price: number | null
  dance_types: DanceType[]
  image_url: string | null
  starts_at: string
  venue: { id: string; name: string } | null
  location: { city: string }
}

type CityGroup = { city: string; social_events: SocialEvent[] }
type DayData  = { day: string; cities: CityGroup[] }
type CardMode = 'single' | 'multi-day' | 'multi-city' | 'multi-day-city'

// ─── Constants ────────────────────────────────────────────────────────────────

const DANCE_EMOJI: Record<DanceType, string> = {
  salsa: '🕺', bachata: '💃', kizomba: '🫂', other: '🎶',
}
const DANCE_LABEL_ES: Record<DanceType, string> = {
  salsa: 'Salsa', bachata: 'Bachata', kizomba: 'Kizomba', other: 'Otros',
}
const MONTHS_ES   = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DAYS_ES     = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MAX_DAYS     = 14
const PREVIEW_SIZE = 480

// ─── Card height estimation ───────────────────────────────────────────────────
// Pixel heights derived from the card's inline CSS + Inter font metrics.
// Header (orange block): 44px top + 34px bottom padding + three lines of text + 2×8px gap
const CARD_HEADER_H_SHORT = 190  // title ≤ 20 chars  (fontSize 50, lineHeight 1.05 → ~53px)
const CARD_HEADER_H_LONG  = 177  // title > 20 chars  (fontSize 38, lineHeight 1.05 → ~40px)
// Footer: 18px×2 padding + 1px border-top + pill height (7+7 pad + 18px text = 32px)
const CARD_FOOTER_H  = 69
// Top padding of the events flex container
const CARD_EVENTS_PAD = 4
// Extra safety margin so content never cuts a row
const CARD_SAFETY    = 16
// Section label rows (day/city headers)
const H_LABEL_FIRST  = 40   // paddingTop 16 + ~17px text + paddingBottom 7
const H_LABEL_REST   = 33   // paddingTop 8  + ~17px text + paddingBottom 7 + 1px border
// Overflow hint ("+ N más en bailorama.com")
const H_OVERFLOW     = 33   // paddingTop 12 + ~21px text

// Row height: compact ? rowPad=10 : rowPad=14; name lineHeight 1.3; venue lineHeight 1.4
function estimateRowH(evt: SocialEvent, compact: boolean): number {
  const pad    = compact ? 10 : 14
  const nameH  = compact ? 24 : 28   // ceil(18*1.3)=24, ceil(21*1.3)=28
  const venueH = compact ? 20 : 24   // ceil(14*1.4)=20, ceil(17*1.4)=24
  return pad * 2 + (evt.venue ? nameH + 3 + venueH : nameH)
}

function computeCardFit(
  sections: CardSection[],
  titleLength: number,
): { visibleCount: number; overflow: number } {
  const totalEvents = sections.reduce((acc, s) => acc + s.events.length, 0)
  const isCompact   = totalEvents > 6
  const headerH     = titleLength > 20 ? CARD_HEADER_H_LONG : CARD_HEADER_H_SHORT
  const available   = 1080 - headerH - CARD_FOOTER_H - CARD_EVENTS_PAD - CARD_SAFETY

  // Flatten sections into a height-simulable sequence
  type FlatItem = { kind: 'label'; isFirst: boolean } | { kind: 'event'; evt: SocialEvent }
  const items: FlatItem[] = []
  let firstLabel = true
  for (const section of sections) {
    if (section.label) { items.push({ kind: 'label', isFirst: firstLabel }); firstLabel = false }
    for (const evt of section.events) items.push({ kind: 'event', evt })
  }

  const itemH = (item: FlatItem) =>
    item.kind === 'label'
      ? (item.isFirst ? H_LABEL_FIRST : H_LABEL_REST)
      : estimateRowH(item.evt, isCompact)

  // If everything fits, no truncation needed
  const totalH = items.reduce((acc, item) => acc + itemH(item), 0)
  if (totalH <= available) return { visibleCount: totalEvents, overflow: 0 }

  // Greedily fill, reserving space for the overflow row
  let budget = available - H_OVERFLOW
  let count  = 0
  for (const item of items) {
    const h = itemH(item)
    if (budget < h) break
    budget -= h
    if (item.kind === 'event') count++
  }
  return { visibleCount: count, overflow: totalEvents - count }
}
const ORANGE      = 'hsl(23, 100%, 65%)'
const CARD_BG     = '#0f0f0f'

// ─── Date utils ───────────────────────────────────────────────────────────────

function toIsoDate(d: Date) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}
function parseDay(isoDate: string) { return new Date(isoDate + 'T12:00:00') }
function formatTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function formatDateLong(isoStr: string) {
  const d = parseDay(isoStr)
  return `${DAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`
}
function formatDateShort(isoStr: string) {
  const d = parseDay(isoStr)
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`
}
function formatDateRangeShort(from: string, to: string) {
  const df = parseDay(from), dt = parseDay(to)
  if (from === to) return formatDateShort(from)
  if (df.getMonth() === dt.getMonth())
    return `${df.getDate()} – ${dt.getDate()} de ${MONTHS_ES[df.getMonth()]}`
  return `${df.getDate()} ${MONTHS_ES[df.getMonth()]} – ${dt.getDate()} ${MONTHS_ES[dt.getMonth()]}`
}
function formatDayLabel(isoStr: string) {
  const d = parseDay(isoStr)
  return `${DAYS_ES[d.getDay()].toUpperCase()} ${d.getDate()}`
}
function getDaysInRange(from: string, to: string): string[] {
  const days: string[] = []
  const cur = parseDay(from)
  const end = parseDay(to)
  while (cur <= end && days.length < MAX_DAYS) {
    days.push(toIsoDate(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}
function getThisWeekend(): [string, string] {
  const now = new Date()
  const dow = now.getDay()
  // Fri of current weekend; Sun = -2, Sat = -1, else 5-dow
  const toFri = dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow
  const fri = new Date(now); fri.setDate(now.getDate() + toFri)
  const sun = new Date(fri); sun.setDate(fri.getDate() + 2)
  return [toIsoDate(fri), toIsoDate(sun)]
}
function getCurrentWeek(): [string, string] {
  const now = new Date()
  const dow = now.getDay()
  const toMon = dow === 0 ? -6 : 1 - dow
  const mon = new Date(now); mon.setDate(now.getDate() + toMon)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return [toIsoDate(mon), toIsoDate(sun)]
}
function cityTag(city: string) {
  return `#${city.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '')}`
}

// ─── Caption generator ────────────────────────────────────────────────────────

function generateCaption(data: DayData[]): string {
  if (data.length === 0) return ''

  const allCities  = Array.from(new Set(data.flatMap(d => d.cities.map(c => c.city))))
  const allEvents  = data.flatMap(d => d.cities.flatMap(c => c.social_events))
  const isMultiDay  = data.length > 1
  const isMultiCity = allCities.length > 1
  const danceTypes  = Array.from(new Set(allEvents.flatMap(e => e.dance_types)))

  const lines: string[] = []
  const cityLabel = isMultiCity ? 'España' : allCities[0]
  lines.push(`🕺 ${allEvents.length} social${allEvents.length !== 1 ? 'es' : ''} de baile en ${cityLabel}`)

  if (!isMultiDay) {
    lines.push(`📅 ${formatDateLong(data[0].day)}`)
  } else {
    const from = data[0].day, to = data[data.length - 1].day
    const dt = parseDay(to)
    lines.push(`📅 ${formatDateLong(from)} – ${DAYS_ES[dt.getDay()]}, ${dt.getDate()} de ${MONTHS_ES[dt.getMonth()]}`)
  }
  lines.push('')

  if (!isMultiDay && !isMultiCity) {
    // Single: flat list
    for (const evt of data[0].cities[0].social_events) {
      const emojis = evt.dance_types.map(d => DANCE_EMOJI[d]).join('')
      const label  = evt.dance_types.map(d => DANCE_LABEL_ES[d]).join('/')
      const price  = evt.price != null ? ` · ${evt.price === 0 ? 'Gratis' : `${evt.price}€`}` : ''
      lines.push(`• ${formatTime(evt.starts_at)} | ${emojis} ${label} | ${evt.name}${price}`)
      if (evt.venue) lines.push(`  📍 ${evt.venue.name}`)
    }
  } else if (isMultiDay && !isMultiCity) {
    // Multi-day, single city
    for (const d of data) {
      lines.push(`${formatDayLabel(d.day)}:`)
      for (const evt of d.cities[0]?.social_events ?? []) {
        const emojis = evt.dance_types.map(t => DANCE_EMOJI[t]).join('')
        const label  = evt.dance_types.map(t => DANCE_LABEL_ES[t]).join('/')
        const price  = evt.price != null ? ` · ${evt.price === 0 ? 'Gratis' : `${evt.price}€`}` : ''
        lines.push(`• ${formatTime(evt.starts_at)} | ${emojis} ${label} | ${evt.name}${price}`)
        if (evt.venue) lines.push(`  📍 ${evt.venue.name}`)
      }
      lines.push('')
    }
  } else if (!isMultiDay && isMultiCity) {
    // Single day, multi-city
    for (const cg of data[0].cities) {
      lines.push(`📍 ${cg.city.toUpperCase()}`)
      for (const evt of cg.social_events) {
        const emojis = evt.dance_types.map(d => DANCE_EMOJI[d]).join('')
        const label  = evt.dance_types.map(d => DANCE_LABEL_ES[d]).join('/')
        lines.push(`• ${formatTime(evt.starts_at)} | ${emojis} ${label} | ${evt.name}`)
        if (evt.venue) lines.push(`  📍 ${evt.venue.name}`)
      }
      lines.push('')
    }
  } else {
    // Multi-day + multi-city: group by day
    for (const d of data) {
      lines.push(`${formatDayLabel(d.day)}:`)
      for (const cg of d.cities) {
        if (d.cities.length > 1) lines.push(`  ${cg.city}:`)
        const indent = d.cities.length > 1 ? '    ' : '  '
        for (const evt of cg.social_events) {
          const emojis = evt.dance_types.map(t => DANCE_EMOJI[t]).join('')
          lines.push(`${indent}• ${formatTime(evt.starts_at)} | ${emojis} ${evt.name}`)
        }
      }
      lines.push('')
    }
  }

  lines.push('Más info en 👉 bailorama.com')
  lines.push('🔗 Link en bio · @bailorama.sociales')
  lines.push('')
  const hashtags = [
    '#bailorama', '#bailelatino', '#socialesdebaile',
    ...allCities.slice(0, 3).map(cityTag),
    ...danceTypes.filter(d => d !== 'other').map(d => `#${d}`),
  ]
  lines.push(hashtags.join(' '))

  return lines.join('\n')
}

// Split selectedData into head (first `count` events) + tail (the rest)
function sliceEvents(data: DayData[], count: number): { head: DayData[]; tail: DayData[] } {
  let rem = count
  const head: DayData[] = []
  const tail: DayData[] = []
  let headDone = false

  for (const day of data) {
    if (headDone) { tail.push(day); continue }
    const hc: CityGroup[] = [], tc: CityGroup[] = []
    for (const city of day.cities) {
      if (headDone) { tc.push(city); continue }
      const take = Math.min(city.social_events.length, rem)
      if (take > 0) hc.push({ city: city.city, social_events: city.social_events.slice(0, take) })
      const rest = city.social_events.slice(take)
      if (rest.length > 0) tc.push({ city: city.city, social_events: rest })
      rem -= take
      if (rem <= 0) headDone = true
    }
    if (hc.length > 0) head.push({ day: day.day, cities: hc })
    if (tc.length > 0) tail.push({ day: day.day, cities: tc })
  }
  return { head, tail }
}

// Build as many 1080×1080 slides as needed to show all events
function buildCarouselSlides(data: DayData[], titleLength: number): DayData[][] {
  const slides: DayData[][] = []
  let remaining = data
  while (remaining.length > 0 && slides.length < 10) {
    const sections = buildCardSections(remaining, getCardMode(remaining))
    const { visibleCount } = computeCardFit(sections, titleLength)
    if (visibleCount === 0) break
    const { head, tail } = sliceEvents(remaining, visibleCount)
    slides.push(head)
    remaining = tail
  }
  return slides
}

// ─── Instagram Card ───────────────────────────────────────────────────────────

type CardSection = {
  label: string | null
  labelKind: 'day' | 'city' | null
  events: SocialEvent[]
}

function getCardMode(data: DayData[]): CardMode {
  const days   = data.length
  const cities = new Set(data.flatMap(d => d.cities.map(c => c.city))).size
  if (days <= 1 && cities <= 1) return 'single'
  if (days <= 1) return 'multi-city'
  if (cities <= 1) return 'multi-day'
  return 'multi-day-city'
}

function getCardHeader(data: DayData[], mode: CardMode) {
  const allCities  = Array.from(new Set(data.flatMap(d => d.cities.map(c => c.city))))
  const isMultiCity = allCities.length > 1
  const from = data[0]?.day ?? ''
  const to   = data[data.length - 1]?.day ?? ''
  const title = isMultiCity
    ? (allCities.length <= 3 ? allCities.join(' · ') : 'España')
    : (allCities[0] ?? '')
  const subtitle = (mode === 'single' || mode === 'multi-city')
    ? formatDateShort(from)
    : formatDateRangeShort(from, to)
  return { title, subtitle }
}

function buildCardSections(data: DayData[], mode: CardMode): CardSection[] {
  if (mode === 'single')
    return [{ label: null, labelKind: null, events: data[0]?.cities[0]?.social_events ?? [] }]

  if (mode === 'multi-city')
    return (data[0]?.cities ?? []).map(c => ({
      label: c.city.toUpperCase(), labelKind: 'city' as const, events: c.social_events,
    }))

  if (mode === 'multi-day')
    return data.map(d => ({
      label: formatDayLabel(d.day), labelKind: 'day' as const,
      events: d.cities[0]?.social_events ?? [],
    }))

  // multi-day-city
  const sections: CardSection[] = []
  for (const d of data) {
    if (d.cities.length === 1) {
      sections.push({ label: formatDayLabel(d.day), labelKind: 'day', events: d.cities[0].social_events })
    } else {
      sections.push({ label: formatDayLabel(d.day), labelKind: 'day', events: [] })
      for (const c of d.cities)
        sections.push({ label: c.city.toUpperCase(), labelKind: 'city', events: c.social_events })
    }
  }
  return sections
}

type CardOverrides = {
  title?: string
  subtitle?: string
  eventNames?: Record<string, string>
}

function InstagramCard({ data, overrides = {}, slideIndex = 0, totalSlides = 1 }: {
  data: DayData[]
  overrides?: CardOverrides
  slideIndex?: number
  totalSlides?: number
}) {
  const mode     = getCardMode(data)
  const { title: autoTitle, subtitle: autoSubtitle } = getCardHeader(data, mode)
  const sections = buildCardSections(data, mode)

  const displayTitle    = overrides.title    || autoTitle
  const displaySubtitle = overrides.subtitle || autoSubtitle

  const totalOriginal = sections.reduce((acc, s) => acc + s.events.length, 0)
  const { visibleCount, overflow } = computeCardFit(sections, displayTitle.length)

  let remaining = visibleCount
  const truncated = sections.map(s => {
    const take = Math.min(s.events.length, remaining)
    remaining -= take
    return { ...s, events: s.events.slice(0, take) }
  })

  const isCompact = totalOriginal > 6
  const nameSize  = isCompact ? 18 : 21
  const venueSize = isCompact ? 14 : 17
  const timeSize  = isCompact ? 18 : 20
  const rowPad    = isCompact ? 10 : 14

  return (
    <div style={{
      width: 1080, height: 1080, background: CARD_BG,
      fontFamily: '"Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', color: '#ffffff',
    }}>
      {/* Header */}
      <div style={{ background: ORANGE, padding: '44px 56px 34px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' }}>
          BAILORAMA.COM
        </div>
        <div style={{ fontSize: displayTitle.length > 20 ? 38 : 50, fontWeight: 800, lineHeight: 1.05, color: '#000', wordBreak: 'break-word' }}>
          {displayTitle}
        </div>
        <div style={{ fontSize: 21, fontWeight: 500, color: 'rgba(0,0,0,0.65)' }}>
          {displaySubtitle}
        </div>
      </div>

      {/* Sections */}
      <div style={{ flex: 1, padding: '4px 56px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {truncated.map((section, si) => (
          <div key={si}>
            {section.label && (
              <div style={{
                paddingTop: si === 0 ? 16 : 8, paddingBottom: 7,
                fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
                color: section.labelKind === 'day' ? ORANGE : 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                borderTop: si === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
              }}>
                {section.label}
              </div>
            )}
            {section.events.map((evt, ei) => {
              const emojis      = evt.dance_types.map(d => DANCE_EMOJI[d]).join('')
              const displayName = overrides.eventNames?.[evt.id] || evt.name
              const isLastRow   = ei === section.events.length - 1
              return (
                <div key={evt.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 18,
                  paddingTop: rowPad, paddingBottom: rowPad,
                  borderBottom: isLastRow ? 'none' : '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ minWidth: 62, fontSize: timeSize, fontWeight: 700, color: ORANGE, lineHeight: 1.4, paddingTop: 1 }}>
                    {formatTime(evt.starts_at)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: nameSize, fontWeight: 600, lineHeight: 1.3, color: '#fff' }}>
                      {emojis} {displayName}
                    </div>
                    {evt.venue && (
                      <div style={{ fontSize: venueSize, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>
                        📍 {evt.venue.name}
                      </div>
                    )}
                  </div>
                  {evt.price != null && (
                    <div style={{
                      fontSize: venueSize + 1, fontWeight: 600, whiteSpace: 'nowrap', paddingTop: 3,
                      color: evt.price === 0 ? '#34d399' : 'rgba(255,255,255,0.45)',
                    }}>
                      {evt.price === 0 ? 'Gratis' : `${evt.price}€`}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {overflow > 0 && (
          <div style={{ padding: '12px 0 0', fontSize: 17, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
            + {overflow} más en bailorama.com
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '18px 56px', borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }}>bailorama.com</div>
          {totalSlides > 1 && (
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' }}>
              {slideIndex + 1} / {totalSlides}
            </div>
          )}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: ORANGE, background: 'rgba(255,145,77,0.12)', padding: '7px 20px', borderRadius: 100 }}>
          @bailorama.sociales
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function InstagramPostPage() {
  const today = toIsoDate(new Date())
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo,   setDateTo]   = useState(today)
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [fetchError,  setFetchError]  = useState('')
  const [allDays,        setAllDays]        = useState<DayData[]>([])
  const [selectedDays,   setSelectedDays]   = useState<Set<string>>(new Set())
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set())
  const [excludedIds,    setExcludedIds]    = useState<Set<string>>(new Set())
  const [expandedDays,   setExpandedDays]   = useState<Set<string>>(new Set())
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set())
  const [caption,      setCaption]      = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [previewSlide, setPreviewSlide] = useState(0)
  const [cardTitleOverride,    setCardTitleOverride]    = useState('')
  const [cardSubtitleOverride, setCardSubtitleOverride] = useState('')
  const [eventNameOverrides,   setEventNameOverrides]   = useState<Record<string, string>>({})
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  // All unique cities across loaded days
  const allCities = useMemo(
    () => Array.from(new Set(allDays.flatMap(d => d.cities.map(c => c.city)))).sort(),
    [allDays]
  )

  // Filtered + excluded-aware data for caption and card
  const selectedData = useMemo<DayData[]>(() =>
    allDays
      .filter(d => selectedDays.has(d.day))
      .map(d => ({
        day: d.day,
        cities: d.cities
          .filter(c => selectedCities.has(c.city))
          .map(c => ({
            city: c.city,
            social_events: c.social_events.filter(e => !excludedIds.has(e.id)),
          }))
          .filter(c => c.social_events.length > 0),
      }))
      .filter(d => d.cities.length > 0),
    [allDays, selectedDays, selectedCities, excludedIds]
  )

  const totalAll      = allDays.reduce((acc, d) => acc + d.cities.reduce((a, c) => a + c.social_events.length, 0), 0)
  const totalSelected = selectedData.reduce((acc, d) => acc + d.cities.reduce((a, c) => a + c.social_events.length, 0), 0)

  // Auto-generated header values (used as placeholders in the editor)
  const autoCardHeader = useMemo(() => {
    if (selectedData.length === 0) return { title: '', subtitle: '' }
    return getCardHeader(selectedData, getCardMode(selectedData))
  }, [selectedData])

  // Carousel slides derived from selected data + current title override
  const carouselSlides = useMemo(() => {
    if (selectedData.length === 0) return []
    const displayTitle = cardTitleOverride || autoCardHeader.title
    return buildCarouselSlides(selectedData, displayTitle.length)
  }, [selectedData, cardTitleOverride, autoCardHeader])

  const activeSlide = Math.min(previewSlide, Math.max(0, carouselSlides.length - 1))

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const loadEvents = useCallback(async (from: string, to: string) => {
    const days = getDaysInRange(from, to)
    if (days.length === 0) return
    setFetchStatus('loading')
    setFetchError('')
    try {
      const results = await Promise.all(
        days.map(async (d) => {
          const res = await apiClient.get<{ cities: CityGroup[] }>(
            `social-events/by-city?${new URLSearchParams({ day: d })}`
          )
          return { day: d, cities: res.cities ?? [] } as DayData
        })
      )
      const withEvents = results.filter(d => d.cities.length > 0)
      setAllDays(withEvents)
      setSelectedDays(new Set(withEvents.map(d => d.day)))
      setSelectedCities(new Set(withEvents.flatMap(d => d.cities.map(c => c.city))))
      setExcludedIds(new Set())
      setExpandedDays(new Set(withEvents.map(d => d.day)))
      setExpandedCities(new Set())
      setCaption(withEvents.length > 0 ? generateCaption(withEvents) : '')
      setFetchStatus('success')
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Request failed')
      setAllDays([])
      setFetchStatus('error')
    }
  }, [])

  // ── Toggles ────────────────────────────────────────────────────────────────

  const toggleDay = (day: string) =>
    setSelectedDays(prev => { const n = new Set(prev); n.has(day) ? n.delete(day) : n.add(day); return n })

  const toggleCity = (city: string) =>
    setSelectedCities(prev => { const n = new Set(prev); n.has(city) ? n.delete(city) : n.add(city); return n })

  const toggleEvent = (id: string) =>
    setExcludedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleDayExpand = (day: string) =>
    setExpandedDays(prev => { const n = new Set(prev); n.has(day) ? n.delete(day) : n.add(day); return n })

  const toggleCityExpand = (day: string, city: string) =>
    setExpandedCities(prev => { const k = `${day}::${city}`; const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  const allCitiesSelected = allCities.length > 0 && allCities.every(c => selectedCities.has(c))
  const toggleAllCities = () =>
    setSelectedCities(allCitiesSelected ? new Set() : new Set(allCities))

  const setPreset = (preset: 'today' | 'weekend' | 'week') => {
    if (preset === 'today')   { setDateFrom(today); setDateTo(today) }
    if (preset === 'weekend') { const [f,t] = getThisWeekend();  setDateFrom(f); setDateTo(t) }
    if (preset === 'week')    { const [f,t] = getCurrentWeek(); setDateFrom(f); setDateTo(t) }
  }

  // ── Caption ────────────────────────────────────────────────────────────────

  const regenerateCaption = () => {
    if (selectedData.length > 0) setCaption(generateCaption(selectedData))
  }

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption)
      setCopyFeedback('Copiado.')
      setTimeout(() => setCopyFeedback(''), 2000)
    } catch { setCopyFeedback('No se pudo copiar.') }
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    const els = cardsRef.current.filter((el): el is HTMLDivElement => el !== null)
    if (els.length === 0 || selectedData.length === 0) return
    setExportStatus('loading')
    try {
      const from     = selectedData[0].day
      const to       = selectedData[selectedData.length - 1].day
      const cities   = Array.from(new Set(selectedData.flatMap(d => d.cities.map(c => c.city))))
      const citySlug = cities.slice(0, 2).join('-').toLowerCase().normalize('NFD').replace(/[̀-ͯ\s]/g, '')
      const dateSfx  = from === to ? from : `${from}_${to}`
      for (let i = 0; i < els.length; i++) {
        const dataUrl = await toPng(els[i], { pixelRatio: 1, cacheBust: true })
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `bailorama-${citySlug}-${dateSfx}${els.length > 1 ? `-${i + 1}` : ''}.png`
        a.click()
        if (i < els.length - 1) await new Promise(r => setTimeout(r, 400))
      }
      setExportStatus('idle')
    } catch { setExportStatus('error') }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-text">Post de Instagram</h1>
        <p className="text-sm text-text/50 mt-1">
          Genera caption e imagen para un día, un finde o toda la semana — en una o varias ciudades.
        </p>
      </div>

      {/* Date range + presets */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3 items-end">
          <Input label="Desde" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-44" />
          <Input label="Hasta" type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className="w-44" />
          <Button
            onClick={() => void loadEvents(dateFrom, dateTo)}
            loading={fetchStatus === 'loading'}
            disabled={fetchStatus === 'loading' || !dateFrom || !dateTo}
          >
            {fetchStatus === 'loading' ? 'Cargando…' : 'Cargar eventos'}
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text/40">Presets:</span>
          {([
            { id: 'today',   label: 'Hoy' },
            { id: 'weekend', label: 'Este finde' },
            { id: 'week',    label: 'Esta semana' },
          ] as const).map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-raised border border-text/10 text-text/50 hover:text-text hover:bg-overlay transition-colors"
            >
              {p.label}
            </button>
          ))}
          {fetchStatus === 'success' && (
            <span className="ml-1 text-xs text-text/40">
              {totalAll} eventos · {allDays.length} día{allDays.length !== 1 ? 's' : ''} · {allCities.length} ciudad{allCities.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
      </div>

      {fetchStatus === 'error' && <Alert variant="critical">{fetchError}</Alert>}
      {fetchStatus === 'success' && allDays.length === 0 && (
        <Alert variant="info">No hay eventos para el rango seleccionado.</Alert>
      )}

      {/* Day + city toggles */}
      {fetchStatus === 'success' && allDays.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {allDays.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-text/40 w-14 shrink-0">Días</span>
              {allDays.map(d => {
                const count = d.cities.reduce((acc, c) => acc + c.social_events.length, 0)
                const on    = selectedDays.has(d.day)
                return (
                  <button key={d.day} onClick={() => toggleDay(d.day)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      on ? 'bg-primary text-white' : 'bg-raised border border-text/10 text-text/50 hover:text-text hover:bg-overlay'
                    }`}
                  >
                    {formatDayLabel(d.day)} <span className="opacity-60">({count})</span>
                  </button>
                )
              })}
            </div>
          )}
          {allCities.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-text/40 w-14 shrink-0">Ciudades</span>
              <button
                onClick={toggleAllCities}
                className="px-3 py-1 rounded-lg text-xs font-medium border border-dashed border-text/20 text-text/40 hover:text-text hover:border-text/40 transition-colors"
              >
                {allCitiesSelected ? 'Ninguna' : 'Todas'}
              </button>
              {allCities.map(city => {
                const count = allDays.reduce((acc, d) => acc + (d.cities.find(c => c.city === city)?.social_events.length ?? 0), 0)
                const on    = selectedCities.has(city)
                return (
                  <button key={city} onClick={() => toggleCity(city)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      on ? 'bg-primary text-white' : 'bg-raised border border-text/10 text-text/50 hover:text-text hover:bg-overlay'
                    }`}
                  >
                    {city} <span className="opacity-60">({count})</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Two-column layout */}
      {fetchStatus === 'success' && allDays.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Left: event list + caption */}
          <div className="flex flex-col gap-4">

            {/* Event list */}
            <div className="rounded-xl border border-text/10 bg-raised overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-text/10">
                <p className="text-sm font-semibold text-text">Eventos</p>
                <span className="text-xs text-text/40">{totalSelected} / {totalAll} incluidos</span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {allDays.map((dayData, di) => {
                  const dayOn    = selectedDays.has(dayData.day)
                  const expanded = expandedDays.has(dayData.day)
                  const dayTotal = dayData.cities.reduce((acc, c) => acc + c.social_events.length, 0)
                  const showDayHeader = allDays.length > 1

                  return (
                    <div key={dayData.day} className={dayOn ? '' : 'opacity-35 pointer-events-none'}>
                      {showDayHeader && (
                        <button
                          onClick={() => toggleDayExpand(dayData.day)}
                          className={`w-full flex items-center gap-2 px-4 py-2.5 transition-colors border-b border-text/5 ${di === 0 ? 'bg-overlay' : 'bg-overlay'} hover:bg-overlay/60`}
                        >
                          <span className="text-xs font-bold text-primary uppercase tracking-wide">
                            {formatDayLabel(dayData.day)}
                          </span>
                          <span className="text-xs text-text/40">({dayTotal})</span>
                          <span className="ml-auto text-text/30 text-xs">{expanded ? '▲' : '▼'}</span>
                        </button>
                      )}

                      {(allDays.length === 1 || expanded) &&
                        dayData.cities
                          .filter(c => selectedCities.has(c.city))
                          .map(cityGroup => {
                            const cityKey      = `${dayData.day}::${cityGroup.city}`
                            const cityExpanded = expandedCities.has(cityKey)
                            const includedCount = cityGroup.social_events.filter(e => !excludedIds.has(e.id)).length
                            return (
                              <div key={cityGroup.city}>
                                <button
                                  onClick={() => toggleCityExpand(dayData.day, cityGroup.city)}
                                  className="w-full flex items-center gap-2 px-4 py-2 border-b border-text/5 hover:bg-overlay transition-colors"
                                >
                                  <span className="text-[10px] font-semibold uppercase tracking-widest text-text/40">
                                    {cityGroup.city}
                                  </span>
                                  <span className="text-[10px] text-text/25">
                                    {includedCount}/{cityGroup.social_events.length}
                                  </span>
                                  <span className="ml-auto text-text/25 text-[10px]">{cityExpanded ? '▲' : '▼'}</span>
                                </button>
                                {cityExpanded && (
                                  <div className="flex flex-col divide-y divide-text/5">
                                    {cityGroup.social_events.map(evt => {
                                      const included = !excludedIds.has(evt.id)
                                      const emojis   = evt.dance_types.map(d => DANCE_EMOJI[d]).join('')
                                      return (
                                        <label key={evt.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-overlay transition-colors">
                                          <Checkbox checked={included} onChange={() => toggleEvent(evt.id)} className="shrink-0" />
                                          {evt.image_url && (
                                            <img src={evt.image_url} alt="" className="size-9 rounded object-cover shrink-0" />
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-text truncate">{emojis} {evt.name}</p>
                                            <p className="text-xs text-text/40 truncate">
                                              {formatTime(evt.starts_at)}
                                              {evt.venue ? ` · ${evt.venue.name}` : ''}
                                              {evt.price != null ? ` · ${evt.price === 0 ? 'Gratis' : `${evt.price}€`}` : ''}
                                            </p>
                                          </div>
                                        </label>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })
                      }
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Caption */}
            <div className="rounded-xl border border-text/10 bg-raised overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-text/10">
                <p className="text-sm font-semibold text-text">Caption</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={regenerateCaption}
                    className="flex items-center gap-1.5 text-xs text-text/40 hover:text-text transition-colors"
                    title="Regenerar desde selección actual"
                  >
                    <RefreshCw size={12} />
                    Regenerar
                  </button>
                  <button
                    onClick={() => void copyCaption()}
                    className="flex items-center gap-1.5 text-xs text-text/40 hover:text-text transition-colors"
                  >
                    <Copy size={12} />
                    {copyFeedback || 'Copiar'}
                  </button>
                </div>
              </div>
              <div className="p-4">
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  rows={16}
                  className="w-full text-xs text-text bg-transparent resize-none outline-none font-mono leading-relaxed"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>

          {/* Right: card preview + editor */}
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-text/10 bg-raised">
              <div className="flex items-center justify-between px-4 py-3 border-b border-text/10 rounded-t-xl overflow-hidden">
                <div>
                  <p className="text-sm font-semibold text-text">Vista previa</p>
                  <p className="text-xs text-text/40 mt-0.5">
                    1080 × 1080 px
                    {carouselSlides.length > 1 && (
                      <span className="ml-1.5 text-primary font-medium">· {carouselSlides.length} slides</span>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => void handleExport()}
                  loading={exportStatus === 'loading'}
                  disabled={totalSelected === 0 || exportStatus === 'loading'}
                >
                  <Download size={13} />
                  {carouselSlides.length > 1 ? `Descargar ${carouselSlides.length} PNGs` : 'Descargar PNG'}
                </Button>
              </div>

              {exportStatus === 'error' && (
                <div className="px-4 pt-3">
                  <Alert variant="critical">Error al exportar la imagen.</Alert>
                </div>
              )}

              <div className="p-4 flex flex-col gap-3">
                {totalSelected === 0 ? (
                  <div
                    className="flex items-center justify-center rounded-lg bg-overlay text-text/30 text-xs"
                    style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
                  >
                    Sin eventos seleccionados
                  </div>
                ) : (
                    <>
                      {carouselSlides.length > 1 && (
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setPreviewSlide(s => Math.max(0, s - 1))}
                            disabled={activeSlide === 0}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium text-text/50 hover:text-text hover:bg-overlay transition-colors disabled:opacity-20 disabled:pointer-events-none"
                          >
                            ← Anterior
                          </button>
                          <div className="flex items-center gap-1.5">
                            {carouselSlides.map((_, i) => (
                              <button
                                key={i}
                                onClick={() => setPreviewSlide(i)}
                                className={`size-2 rounded-full transition-colors ${i === activeSlide ? 'bg-primary' : 'bg-text/20 hover:bg-text/40'}`}
                              />
                            ))}
                          </div>
                          <button
                            onClick={() => setPreviewSlide(s => Math.min(carouselSlides.length - 1, s + 1))}
                            disabled={activeSlide >= carouselSlides.length - 1}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium text-text/50 hover:text-text hover:bg-overlay transition-colors disabled:opacity-20 disabled:pointer-events-none"
                          >
                            Siguiente →
                          </button>
                        </div>
                      )}

                      {/* Visible preview for active slide */}
                      <div className="rounded-lg overflow-hidden" style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}>
                        <div style={{ width: 1080, height: 1080, transform: `scale(${PREVIEW_SIZE / 1080})`, transformOrigin: 'top left' }}>
                          <InstagramCard
                            data={carouselSlides[activeSlide]}
                            overrides={{ title: cardTitleOverride, subtitle: cardSubtitleOverride, eventNames: eventNameOverrides }}
                            slideIndex={activeSlide}
                            totalSlides={carouselSlides.length}
                          />
                        </div>
                      </div>

                      {/* Off-screen cards kept in DOM for export */}
                      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
                        {carouselSlides.map((slideData, i) => (
                          <div key={i} ref={el => { cardsRef.current[i] = el }}>
                            <InstagramCard
                              data={slideData}
                              overrides={{ title: cardTitleOverride, subtitle: cardSubtitleOverride, eventNames: eventNameOverrides }}
                              slideIndex={i}
                              totalSlides={carouselSlides.length}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                )}
              </div>
            </div>
            {/* Card text editor */}
            <div className="rounded-xl border border-text/10 bg-raised overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-text/10">
                <p className="text-sm font-semibold text-text">Editar texto de la imagen</p>
                {(cardTitleOverride || cardSubtitleOverride || Object.keys(eventNameOverrides).length > 0) && (
                  <button
                    onClick={() => { setCardTitleOverride(''); setCardSubtitleOverride(''); setEventNameOverrides({}) }}
                    className="text-xs text-text/40 hover:text-text transition-colors"
                  >
                    Restablecer todo
                  </button>
                )}
              </div>
              <div className="p-4 flex flex-col gap-3">
                {/* Title */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-text/40">Título</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={cardTitleOverride}
                      onChange={e => setCardTitleOverride(e.target.value)}
                      placeholder={autoCardHeader.title || 'Auto'}
                      className="w-full rounded-lg border border-text/10 bg-base px-3 py-2 text-sm text-text placeholder:text-text/25 outline-none focus:border-primary/50 transition-colors pr-7"
                    />
                    {cardTitleOverride && (
                      <button onClick={() => setCardTitleOverride('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text/30 hover:text-text transition-colors text-xs">✕</button>
                    )}
                  </div>
                </div>
                {/* Subtitle */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-text/40">Subtítulo</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={cardSubtitleOverride}
                      onChange={e => setCardSubtitleOverride(e.target.value)}
                      placeholder={autoCardHeader.subtitle || 'Auto'}
                      className="w-full rounded-lg border border-text/10 bg-base px-3 py-2 text-sm text-text placeholder:text-text/25 outline-none focus:border-primary/50 transition-colors pr-7"
                    />
                    {cardSubtitleOverride && (
                      <button onClick={() => setCardSubtitleOverride('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text/30 hover:text-text transition-colors text-xs">✕</button>
                    )}
                  </div>
                </div>
                {/* Per-event names for the active slide */}
                {carouselSlides.length > 0 && (() => {
                  const slideEvents = (carouselSlides[activeSlide] ?? []).flatMap(d => d.cities.flatMap(c => c.social_events))
                  if (slideEvents.length === 0) return null
                  return (
                    <div className="flex flex-col gap-2 pt-1 border-t border-text/[0.08]">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-text/40 pt-1">
                        {carouselSlides.length > 1 ? `Eventos — slide ${activeSlide + 1}` : 'Eventos'}
                      </p>
                      {slideEvents.map(evt => {
                        const emojis = evt.dance_types.map(d => DANCE_EMOJI[d]).join('')
                        return (
                          <div key={evt.id} className="flex items-center gap-2">
                            <span className="text-xs text-primary font-semibold shrink-0 w-11 tabular-nums">
                              {formatTime(evt.starts_at)}
                            </span>
                            <span className="text-xs shrink-0">{emojis}</span>
                            <div className="relative flex-1 min-w-0">
                              <input
                                type="text"
                                value={eventNameOverrides[evt.id] ?? ''}
                                onChange={e => setEventNameOverrides(prev =>
                                  e.target.value
                                    ? { ...prev, [evt.id]: e.target.value }
                                    : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== evt.id))
                                )}
                                placeholder={evt.name}
                                className="w-full rounded-lg border border-text/10 bg-base px-2.5 py-1.5 text-xs text-text placeholder:text-text/25 outline-none focus:border-primary/50 transition-colors pr-6"
                              />
                              {eventNameOverrides[evt.id] && (
                                <button
                                  onClick={() => setEventNameOverrides(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== evt.id)))}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text/30 hover:text-text transition-colors text-[10px]"
                                >✕</button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
