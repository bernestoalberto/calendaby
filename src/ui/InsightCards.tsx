import type { StoredInsight } from '../domain/store'
import { SparkIcon } from './icons'

interface Props {
  cards: StoredInsight[]
  /** How many to show; the rest wait on the Growth screen. */
  limit?: number
  onDismiss: (id: string) => void
}

const TOPIC: Record<StoredInsight['topic'], string> = {
  growth: 'Growth',
  milestones: 'Milestones',
  sleep: 'Sleep',
  rhythm: 'Rhythm',
  health: 'Health',
}

/** Notes the assistant wrote from the baby's own data. They are text only and never replace the pediatrician. */
export function InsightCards({ cards, limit, onDismiss }: Readonly<Props>) {
  const shown = cards.slice(0, limit)
  if (shown.length === 0) return null
  return (
    <>
      {shown.map((c) => (
        <section key={c.id} className="card ai-insight" aria-label={`Insight: ${c.title}`}>
          <div className="card-head">
            <h3>
              <SparkIcon width={18} height={18} /> {c.title}
            </h3>
            <span className="muted small">{TOPIC[c.topic]}</span>
          </div>
          <p>{c.body}</p>
          {c.sources.length > 0 && (
            <p className="muted small">
              Source:{' '}
              {c.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && ', '}
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.org}
                  </a>
                </span>
              ))}
            </p>
          )}
          <div className="card-foot">
            <span className="muted small">Written by the assistant from your log. Not medical advice.</span>
            <button type="button" className="link muted" onClick={() => onDismiss(c.id)}>
              Got it
            </button>
          </div>
        </section>
      ))}
    </>
  )
}
