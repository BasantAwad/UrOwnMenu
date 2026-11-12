import { motion } from 'motion/react'
import { focalTransition, snapTransition } from './motion'

export type OrbitNavItem = {
  id: string
  index: number
  label: string
  count: number
}

/**
 * Numbered orbital category navigation.
 *
 * Based on the Wove mobile navigation reference in docs/INSPIRATION.md:
 * a thin elliptical orbit entering from the left, tiny orbit markers with
 * one prominent active marker, an oversized active number, a bold title and
 * light supporting copy beside it, other numbers receding in muted grey, and
 * generous negative space with asymmetry.
 *
 * The layout is calculated rather than hand-placed: markers are positioned
 * along an ellipse as a percentage of the stage, so they stay on the ring at
 * any size.
 *
 * Reference: https://wove.com/ - design reference only, no artwork or code
 * is copied.
 */
export default function OrbitNav({
  items,
  activeId,
  onChange,
}: {
  items: OrbitNavItem[]
  activeId: string
  onChange: (id: string) => void
}) {
  const activeIndex = Math.max(
    0,
    items.findIndex((i) => i.id === activeId),
  )
  const active = items[activeIndex]

  // Ellipse geometry, in the SVG's own coordinate space.
  const radiusX = 210
  const radiusY = 118
  const STAGE_W = 520
  const STAGE_H = 280

  const positionOf = (angle: number) => ({
    left: ((260 + Math.cos(angle) * radiusX) / STAGE_W) * 100 + '%',
    top: ((140 + Math.sin(angle) * radiusY) / STAGE_H) * 100 + '%',
  })

  return (
    <div className="orbitNav">
      <div className="orbitNav__stage">
        {/* The orbit itself. */}
        <svg
          className="orbitNav__ring"
          viewBox={'0 0 ' + STAGE_W + ' ' + STAGE_H}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id="orbitNavFade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
              <stop offset="22%" stopColor="currentColor" stopOpacity="0.9" />
              <stop offset="78%" stopColor="currentColor" stopOpacity="0.9" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.ellipse
            cx="260"
            cy="140"
            rx={radiusX}
            ry={radiusY}
            fill="none"
            stroke="url(#orbitNavFade)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            initial={false}
            animate={{ rotate: 0 }}
            transition={focalTransition}
          />
        </svg>

        {/* Markers, positioned along the ellipse. */}
        {items.map((item, idx) => {
          const isActive = item.id === activeId
          // The active marker sits at the leading edge of the orbit.
          const angle = isActive
            ? -Math.PI / 2
            : (idx / Math.max(items.length, 1)) * Math.PI * 2 - Math.PI / 2 + 0.42
          const pos = positionOf(angle)

          return (
            <motion.button
              type="button"
              key={item.id}
              className={
                'orbitNav__marker' +
                (isActive ? ' is-active' : '') +
                (idx < activeIndex ? ' is-past' : '')
              }
              style={pos}
              animate={{
                scale: isActive ? 1.35 : 1,
                opacity: isActive ? 1 : idx < activeIndex ? 0.3 : 0.55,
              }}
              transition={focalTransition}
              onClick={() => onChange(item.id)}
              aria-current={isActive ? 'true' : undefined}
            >
              <motion.span
                className="orbitNav__markerNum"
                animate={{ fontSize: isActive ? 17 : 12 }}
                transition={focalTransition}
              >
                {String(item.index + 1).padStart(2, '0')}
              </motion.span>
              <motion.span
                className="orbitNav__markerDot"
                aria-hidden="true"
                animate={{
                  width: isActive ? 13 : 7,
                  height: isActive ? 13 : 7,
                  backgroundColor: isActive ? '#ffffff' : 'currentColor',
                }}
                transition={snapTransition}
              />
              <span className="sr-only">
                {item.label}, {item.count} items
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Active marker content, beside the orbit with asymmetry. */}
      <div className="orbitNav__copy">
        <span className="tpl-label">
          {String(activeIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
        </span>
        <AnimateTitle key={active?.id} text={active?.label || ''} />
        <p className="orbitNav__sub">
          {active ? active.count + (active.count === 1 ? ' item' : ' items') : ''}
        </p>
      </div>
    </div>
  )
}

/** The active title re-enters when the selection changes. */
function AnimateTitle({ text }: { text: string }) {
  return (
    <motion.h3
      className="orbitNav__title"
      key={text}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={focalTransition}
    >
      {text}
    </motion.h3>
  )
}
