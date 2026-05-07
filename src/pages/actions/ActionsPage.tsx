import { useState } from 'react'
import { AutoActivateSocialEventsDialog } from './AutoActivateSocialEventsDialog'
import { RevalidateSocialEventsDialog } from './RevalidateSocialEventsDialog'
import { RunPostsProcessingDialog } from './RunPostsProcessingDialog'
import { GenerateScraperPayloadDialog } from './GenerateScraperPayloadDialog'
import { RunScraperDialog } from './RunScraperDialog'
import { RunScraperByAccountDialog } from './RunScraperByAccountDialog'
import { AddInstagramPostsFromFileDialog } from './AddInstagramPostsFromFileDialog'
import { ProcessEventFlyerDialog } from './ProcessEventFlyerDialog'
import { CreateNewSocialEventDialog } from './CreateNewSocialEventDialog'
import { AddSocialEventsFromPostDialog } from './AddSocialEventsFromPostDialog'
import { ListSocialEventsByCityDialog } from './ListSocialEventsByCityDialog'
import { AddVenueDialog } from './AddVenueDialog'
import { AddLocationDialog } from './AddLocationDialog'
import { AddInstagramAccountDialog } from './AddInstagramAccountDialog'
import { AddPublisherDialog } from './AddPublisherDialog'

type ActionId =
  | 'generate-apify-input'
  | 'add-instagram-posts-from-file'
  | 'run-scraper'
  | 'run-scraper-by-account'
  | 'run-posts-processing'
  | 'auto-activate-social-events'
  | 'revalidate-social-events'
  | 'process-event-flyer'
  | 'create-new-social-event'
  | 'add-social-events-from-post'
  | 'list-social-events-by-city'
  | 'add-venue'
  | 'add-location'
  | 'add-instagram-account'
  | 'add-publisher'
  | null

const INSTAGRAM_ACTIONS: {
  id: ActionId
  title: string
  description: string
  accent: string
  icon: string
}[] = [
  {
    id: 'generate-apify-input',
    title: 'Generate Apify input',
    description: 'Build the JSON payload for the Apify Instagram scraper from your venues.',
    accent: '#9c27b0',
    icon: '{}',
  },
  {
    id: 'add-instagram-posts-from-file',
    title: 'Add posts from file',
    description: 'Upload Apify scraper output JSON to import posts and link them to venues.',
    accent: '#e91e63',
    icon: '↑',
  },
  {
    id: 'run-scraper',
    title: 'Run scraper',
    description: 'Triggers the backend scraper job (runs in background).',
    accent: '#ff6f00',
    icon: '⚡',
  },
  {
    id: 'run-scraper-by-account',
    title: 'Run scraper by account',
    description: 'Start scraping for one Instagram account ID with search autocomplete.',
    accent: '#ef6c00',
    icon: '@',
  },
  {
    id: 'run-posts-processing',
    title: 'Run posts processing',
    description: 'Start the pipeline that generates social events from imported posts.',
    accent: '#00acc1',
    icon: '▶',
  },
  {
    id: 'auto-activate-social-events',
    title: 'Auto-activate social events',
    description: 'Start automatic activation of social events in the background.',
    accent: '#00897b',
    icon: '✓',
  },
  {
    id: 'revalidate-social-events',
    title: 'Revalidate social events',
    description: 'Trigger social-events revalidation (202 Accepted).',
    accent: '#2e7d32',
    icon: '↻',
  },
  {
    id: 'process-event-flyer',
    title: 'Process event flyer',
    description: 'Upload an event flyer image and create events with required publisher and optional venue.',
    accent: '#5e35b1',
    icon: '🖼',
  },
  {
    id: 'create-new-social-event',
    title: 'Create new social event',
    description: 'Upload image and create a social event with required publisher and optional venue.',
    accent: '#6d4c41',
    icon: '✚',
  },
  {
    id: 'add-social-events-from-post',
    title: 'Create from Instagram post',
    description: 'Create social events from an Instagram post URL with publisher and optional venue.',
    accent: '#455a64',
    icon: 'IG',
  },
  {
    id: 'list-social-events-by-city',
    title: 'Events by city',
    description: 'View social events for a day grouped by city, with image and video generation.',
    accent: '#1e88e5',
    icon: '🏙',
  },
]

const VENUE_ACTIONS: typeof INSTAGRAM_ACTIONS = [
  {
    id: 'add-venue',
    title: 'Add new venue',
    description: 'Create a venue with name, Google Maps URL, and active status.',
    accent: '#1565c0',
    icon: '+',
  },
  {
    id: 'add-location',
    title: 'Add new location',
    description: 'Create a location from a Google Maps URL.',
    accent: '#00695c',
    icon: '📍',
  },
  {
    id: 'add-instagram-account',
    title: 'Add Instagram account',
    description: 'Create an Instagram account record with scraping flags and active status.',
    accent: '#8e24aa',
    icon: '@',
  },
  {
    id: 'add-publisher',
    title: 'Add publisher',
    description: 'Create a publisher linked to an Instagram account and a fallback venue.',
    accent: '#3949ab',
    icon: 'P',
  },
]

function ActionCard({
  title,
  description,
  accent,
  icon,
  onClick,
}: {
  title: string
  description: string
  accent: string
  icon: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left flex flex-col gap-3 rounded-xl border border-text/10 bg-raised p-5 transition-all hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <div
        className="flex size-10 items-center justify-center rounded-lg text-lg font-semibold shrink-0"
        style={{ background: `${accent}18`, color: accent }}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-text">{title}</span>
        <span className="text-xs text-text/50 leading-relaxed">{description}</span>
      </div>
      <span className="text-xs font-semibold" style={{ color: accent }}>
        Open →
      </span>
    </button>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{title}</p>
      <p className="mt-0.5 text-xs text-text/50">{description}</p>
    </div>
  )
}

export function ActionsPage() {
  const [open, setOpen] = useState<ActionId>(null)

  return (
    <div className="flex flex-col gap-10 max-w-4xl">
      {/* Instagram & social events */}
      <section>
        <SectionHeader
          title="Instagram & social events"
          description="Scrape Instagram via Apify, import posts, generate social events, and auto-activate them."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {INSTAGRAM_ACTIONS.map((action) => (
            <ActionCard
              key={action.id}
              title={action.title}
              description={action.description}
              accent={action.accent}
              icon={action.icon}
              onClick={() => setOpen(action.id)}
            />
          ))}
        </div>
      </section>

      {/* Venues */}
      <section>
        <SectionHeader
          title="Venues"
          description="Create and manage venues, locations, Instagram accounts, and publishers."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {VENUE_ACTIONS.map((action) => (
            <ActionCard
              key={action.id}
              title={action.title}
              description={action.description}
              accent={action.accent}
              icon={action.icon}
              onClick={() => setOpen(action.id)}
            />
          ))}
        </div>
      </section>

      {/* Action dialogs */}
      <AutoActivateSocialEventsDialog
        open={open === 'auto-activate-social-events'}
        onClose={() => setOpen(null)}
      />

      <RevalidateSocialEventsDialog
        open={open === 'revalidate-social-events'}
        onClose={() => setOpen(null)}
      />
      <RunPostsProcessingDialog
        open={open === 'run-posts-processing'}
        onClose={() => setOpen(null)}
      />

      <GenerateScraperPayloadDialog
        open={open === 'generate-apify-input'}
        onClose={() => setOpen(null)}
      />

      <RunScraperDialog
        open={open === 'run-scraper'}
        onClose={() => setOpen(null)}
      />

      <RunScraperByAccountDialog
        open={open === 'run-scraper-by-account'}
        onClose={() => setOpen(null)}
      />

      <AddInstagramPostsFromFileDialog
        open={open === 'add-instagram-posts-from-file'}
        onClose={() => setOpen(null)}
      />

      <ProcessEventFlyerDialog
        open={open === 'process-event-flyer'}
        onClose={() => setOpen(null)}
      />

      <CreateNewSocialEventDialog
        open={open === 'create-new-social-event'}
        onClose={() => setOpen(null)}
      />

      <AddSocialEventsFromPostDialog
        open={open === 'add-social-events-from-post'}
        onClose={() => setOpen(null)}
      />

      <ListSocialEventsByCityDialog
        open={open === 'list-social-events-by-city'}
        onClose={() => setOpen(null)}
      />

      <AddVenueDialog
        open={open === 'add-venue'}
        onClose={() => setOpen(null)}
      />

      <AddLocationDialog
        open={open === 'add-location'}
        onClose={() => setOpen(null)}
      />

      <AddInstagramAccountDialog
        open={open === 'add-instagram-account'}
        onClose={() => setOpen(null)}
      />

      <AddPublisherDialog
        open={open === 'add-publisher'}
        onClose={() => setOpen(null)}
      />
    </div>
  )
}
