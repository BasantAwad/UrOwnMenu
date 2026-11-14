/**
 * ScrollScrub: a video that plays with the page. Scroll down and the video
 * moves forward; scroll up and it rewinds, because its time is set from the
 * scroll position rather than played.
 *
 * Why scrub instead of play: playback runs on its own clock, so it drifts from
 * the reader's hand and cannot go backwards smoothly. Setting currentTime from
 * scroll progress keeps the picture locked to the gesture in both directions.
 *
 * Performance rules, built in:
 *  - Seeks are throttled to one per frame and skipped when the target is within
 *    one frame, so a fast wheel flick does not queue hundreds of seeks.
 *  - Progress is eased, which hides trackpad jitter and makes stops feel soft.
 *  - The video is prepared by scripts/make-scrub-video.sh (every frame a
 *    keyframe), which is what makes seeking responsive.
 *  - On iOS the video is primed once (play then pause) so it decodes on demand.
 *  - prefers-reduced-motion: the poster is shown and nothing is scrubbed.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import './scrub.css'

type Props = {
  src: string
  poster?: string
  /** Total scroll distance for the whole video, e.g. '300vh'. */
  height?: string
  /** Shown over the video while it is pinned. Keep it readable on every frame. */
  children?: ReactNode
  /** Frames per second of the source, used to avoid seeks within one frame. */
  fps?: number
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export function ScrollScrub({ src, poster, height = '300vh', children, fps = 30 }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    const section = sectionRef.current
    if (!video || !section) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    let frame = 0
    let eased = 0
    let target = 0

    const progress = () => {
      const rect = section.getBoundingClientRect()
      const span = section.offsetHeight - window.innerHeight
      return span > 0 ? clamp01(-rect.top / span) : 0
    }

    const tick = () => {
      frame = 0
      target = progress()
      eased += (target - eased) * 0.2
      const d = video.duration
      if (Number.isFinite(d) && d > 0) {
        const t = eased * d
        // Skip seeks that would land within one frame of where we already are.
        if (Math.abs(video.currentTime - t) > 1 / fps) video.currentTime = t
      }
      if (Math.abs(target - eased) > 0.0005) frame = requestAnimationFrame(tick)
    }

    const request = () => {
      if (!frame) frame = requestAnimationFrame(tick)
    }

    const onReady = () => {
      setReady(true)
      // iOS decodes on demand only after one play call; pause straight away.
      video.play().then(() => video.pause()).catch(() => {})
      request()
    }

    video.addEventListener('loadeddata', onReady)
    window.addEventListener('scroll', request, { passive: true })
    window.addEventListener('resize', request)
    if (video.readyState >= 2) onReady()

    return () => {
      video.removeEventListener('loadeddata', onReady)
      window.removeEventListener('scroll', request)
      window.removeEventListener('resize', request)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [src, fps])

  return (
    <section ref={sectionRef} className="scrub" style={{ height }} data-ready={ready || undefined}>
      <div className="scrub__stick">
        <video
          ref={videoRef}
          className="scrub__video"
          src={src}
          poster={poster}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        />
        {children ? <div className="scrub__content">{children}</div> : null}
      </div>
    </section>
  )
}
