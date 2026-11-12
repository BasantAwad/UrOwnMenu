import * as React from 'react'
import { motion, useScroll, useSpring } from 'motion/react'
import { houseEase, houseSpring, snapTransition } from './motion'

/**
 * Reading progress indicator.
 *
 * A thin bar pinned to the top of the published menu that fills as the page
 * is scrolled. The reference implementation scales the bar on the X axis
 * from the scroll ratio.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 260, damping: 24, mass: 1 })

  return (
    <motion.div
      className="scrollProgress"
      style={{ scaleX }}
      aria-hidden="true"
    />
  )
}

/**
 * Sliding tab indicator.
 *
 * The reference approach is a single bar that slides to the selected tab
 * rather than an underline that appears and disappears:
 * `transition: left 250ms ease, width 250ms ease`.
 *
 * The bar is absolutely positioned inside the tab strip, so the target tab's
 * `offsetLeft` / `offsetWidth` are already relative to that strip. Using
 * offsets rather than a parent ref avoids a timing trap: React attaches a
 * parent's ref after the child's layout effect has run, so a child that
 * measures through a parent ref on mount would measure nothing.
 */
export function TabIndicator({
  activeId,
  scope = 'document',
  className = '',
}: {
  activeId: string
  scope?: string
  className?: string
}) {
  const [box, setBox] = React.useState<{ left: number; width: number } | null>(null)

  const measure = React.useCallback(() => {
    if (!activeId) {
      setBox(null)
      return
    }
    const root: ParentNode =
      scope === 'document' ? document : document.querySelector(scope) || document
    const target = root.querySelector('[data-tab-id="' + activeId + '"]')
    if (!target) return
    setBox((prev) => {
      const left = (target as HTMLElement).offsetLeft
      const width = (target as HTMLElement).offsetWidth
      if (prev && Math.abs(prev.left - left) < 0.5 && Math.abs(prev.width - width) < 0.5) {
        return prev
      }
      return { left, width }
    })
  }, [activeId, scope])

  React.useLayoutEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  React.useEffect(() => {
    // Re-measure once fonts have settled, since the tab labels shift.
    const t = setTimeout(measure, 400)
    return () => clearTimeout(t)
  }, [measure])

  return box ? (
    <motion.span
      className={'tabIndicator__bar ' + className}
      initial={false}
      animate={{ left: box.left, width: box.width }}
      transition={snapTransition}
    />
  ) : null
}

/**
 * Reveals an image by wiping a clip-path across it.
 *
 * `clip-path: inset(0 100% 0 0)` -> `inset(0 0 0 0)`.
 * Clip-path is not as cheap as a transform, so this is used only on the
 * hero and signature imagery.
 */
export function ImageReveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      className={className}
      initial={{ clipPath: 'inset(0 100% 0 0)', opacity: 0 }}
      whileInView={{ clipPath: 'inset(0 0 0 0)', opacity: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, ease: houseEase, delay }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Press feedback for a control.
 *
 * The reference button config: scale 0.92, y 2, spring 260/24/1.
 * Exported as plain values so any button can use them without a wrapper.
 */
export const pressFeedback = {
  scale: 0.94,
  y: 1,
} as const

export const pressTransition = houseSpring
