import * as React from 'react'
import { api } from './api'
import type { PublishedSnapshot } from './api'
import { TemplateRenderer, paletteVars } from './templates'
import { ScrollProgress } from './motion-parts'

/**
 * Public menu renderer - no authentication required.
 * Rendered at /m/:slug on the web app.
 */
export default function PublicMenu({ slug }: { slug: string }) {
  const [snapshot, setSnapshot] = React.useState<PublishedSnapshot | null>(null)
  const [meta, setMeta] = React.useState<{ versionNumber: number; checksum: string; publishedAt: string } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.publicMenu(slug)
        if (cancelled) return
        setSnapshot(res.menu)
        setMeta({ versionNumber: res.versionNumber, checksum: res.checksum, publishedAt: res.publishedAt })
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return <div className="app app--centered"><div className="boot">Loading menu…</div></div>
  }

  if (error || !snapshot) {
    return (
      <div className="app app--centered">
        <div className="card public__missing">
          <h1 className="form__title">Menu not available</h1>
          <p className="form__lede">{error || 'This menu has not been published yet.'}</p>
        </div>
      </div>
    )
  }

  const vars = paletteVars(snapshot)
  const credits = ingredientCredits(snapshot)

  return (
    <div className="public" style={vars}>
      <ScrollProgress />
      <main className="public__canvas">
        <TemplateRenderer
          template={snapshot.template.key}
          snapshot={snapshot}
        />
      </main>

      {/*
        Attribution for the macro ingredient photography (CC-BY / CC-BY-SA
        sources). Never rendered for CC0 / public-domain material, but shown
        for anything whose licence asks for it - shown for all of them to be
        safe and honest.
      */}
      {credits.length > 0 && (
        <div className="public__credits">
          <span className="public__creditsLabel">Ingredient photography</span>
          {credits.map((c) => (
            <span key={c.url} className="public__credit">
              {c.displayName}:{' '}
              {c.licenseUrl ? (
                <a href={c.licenseUrl} target="_blank" rel="noreferrer license">{c.license}</a>
              ) : (
                c.license
              )}
              {c.creator && (
                <>
                  {' · '}
                  {c.sourceUrl ? (
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer">{c.creator}</a>
                  ) : (
                    c.creator
                  )}
                </>
              )}
            </span>
          ))}
        </div>
      )}

      <footer className="public__footer">
        <span>
          {snapshot.restaurant.name}
          {snapshot.restaurant.phone ? ' · ' + snapshot.restaurant.phone : ''}
        </span>
        {meta && (
          <span className="public__version">
            Published v{meta.versionNumber} · {new Date(meta.publishedAt).toLocaleDateString()}
          </span>
        )}
        <a className="public__by" href="/" >
          Made with UrOwnMenu
        </a>
      </footer>
    </div>
  )
}

/** Unique credits for the ingredient photos embedded in the snapshot. */
function ingredientCredits(snapshot: PublishedSnapshot) {
  const seen = new Map<string, { displayName: string; url: string; license: string; licenseUrl: string | null; creator: string | null; sourceUrl: string | null }>()
  for (const photo of Object.values(snapshot.ingredientPhotos || {})) {
    if (!seen.has(photo.url)) {
      seen.set(photo.url, {
        displayName: photo.displayName,
        url: photo.url,
        license: photo.license,
        licenseUrl: photo.licenseUrl,
        creator: photo.creator,
        sourceUrl: photo.sourceUrl,
      })
    }
  }
  return [...seen.values()]
}
