/**
 * LayerStage renders one `LayerPlan` (docs/PIPELINE_BUILD_SPEC.md section 11).
 *
 * It is deliberately dumb: the planner already decided position, size, depth,
 * blur, rotation, z-order and parallax. This component applies those numbers
 * and refuses to draw anything whose gate result is not `ok`. It never invents
 * placement, never crops a cutout, and never uses `box-shadow` (cutouts get a
 * `drop-shadow` so the shadow follows the matte).
 *
 * Coordinates are normalised to the stage. `scale: 1` means one third of the
 * stage width, so the rendered width is `scale / 3 * 100%`.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { Layer, LayerPlan, Stage } from './contracts.ts'
import './layer-stage.css'

/** One stored cutout, after the gate. Unpassed assets are not rendered. */
export type StageAsset = {
  src: string
  width: number
  height: number
  gate: { ok: boolean; reasons: string[] }
  /** Accessible name. Cutouts are decorative, so the default is empty. */
  alt?: string
}

export type LayerStageProps = {
  plan: LayerPlan
  assets: Record<string, StageAsset>
  stage: Stage
  /** Copy block, positioned inside the stage's copy zone above the layers. */
  copy?: ReactNode
  className?: string
}

const PARALLAX_TRAVEL_PX = 60

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

/**
 * Scroll progress for the stage, 0..1, written to `--parallax` on the element.
 * Using a CSS custom property keeps scrolling off React's render path; the
 * media query in layer-stage.css turns the whole effect off for reduced motion.
 */
function useParallax(ref: React.RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const element = ref.current
    if (!element || prefersReducedMotion()) return

    let frame = 0
    const measure = () => {
      frame = 0
      const rect = element.getBoundingClientRect()
      const viewport = window.innerHeight || 1
      const raw = (viewport - rect.top) / (viewport + rect.height)
      element.style.setProperty('--parallax', String(Math.min(1, Math.max(0, raw))))
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [ref])
}

function layerStyle(layer: Layer): CSSProperties {
  return {
    left: `${layer.x * 100}%`,
    top: `${layer.y * 100}%`,
    width: `${(layer.scale / 3) * 100}%`,
    zIndex: layer.z,
    // Read by layer-stage.css; custom properties are not typed in React's CSSProperties.
    ['--layer-rotation' as string]: `${layer.rotation}deg`,
    ['--layer-parallax' as string]: String(layer.parallax),
    ['--layer-blur' as string]: `${layer.blurPx}px`,
  }
}

export function LayerStage({ plan, assets, stage, copy, className }: LayerStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  useParallax(stageRef)

  const zone = stage.copyZone
  const ordered = [...plan.layers].sort((a, b) => a.z - b.z)

  return (
    <div
      ref={stageRef}
      className={['layer-stage', className].filter(Boolean).join(' ')}
      style={{ aspectRatio: String(stage.aspect), ['--parallax-travel' as string]: `${-PARALLAX_TRAVEL_PX}px` }}
      data-seed={plan.seed}
    >
      {ordered.map((layer) => {
        const asset = assets[layer.assetId]
        // The definition of done: never display an asset the gate rejected.
        if (!asset || !asset.gate.ok) return null
        const blurred = layer.blurPx > 0
        return (
          <span
            key={layer.assetId}
            className={`layer-stage__layer layer-stage__layer--${layer.kind}`}
            style={layerStyle(layer)}
            data-asset={layer.assetId}
            data-depth={layer.depth.toFixed(3)}
          >
            <img
              className={blurred ? 'layer-stage__img is-blurred' : 'layer-stage__img'}
              src={asset.src}
              width={asset.width}
              height={asset.height}
              alt={asset.alt ?? ''}
              loading={layer.kind === 'hero' ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
            />
          </span>
        )
      })}

      {copy ? (
        <div
          className="layer-stage__copy"
          style={{
            left: `${zone.x * 100}%`,
            top: `${zone.y * 100}%`,
            width: `${zone.w * 100}%`,
            height: `${zone.h * 100}%`,
          }}
        >
          {copy}
        </div>
      ) : null}
    </div>
  )
}

export default LayerStage
