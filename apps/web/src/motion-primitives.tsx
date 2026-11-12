import * as React from 'react'
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react'

/**
 * Shared motion primitives - the house visual grammar every template draws
 * from. Everything here animates transform + opacity only, and honours
 * prefers-reduced-motion by rendering plain output.
 */

/** Rise-in on first view: springy entrance with a soft blur fade. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.3, margin: '0px 0px -8% 0px' }}
      transition={{ type: 'spring', stiffness: 200, damping: 25, mass: 1, delay }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Scroll-scrubbed parallax: children drift slower than the scroll, giving
 * hero/feature photography weight. Transform-only; no layout work.
 */
export function Parallax({
  children,
  className,
  amount = 7,
}: {
  children: React.ReactNode
  className?: string
  /** Percent of the wrapper's height the child travels across the scroll. */
  amount?: number
}) {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const y = useSpring(
    useTransform(scrollYProgress, [0, 1], [`${amount}%`, `${-amount}%`]),
    { stiffness: 140, damping: 26, mass: 0.7 },
  )
  if (reduced) return <div className={className}>{children}</div>
  return (
    <div ref={ref} className={className} style={{ overflow: 'hidden' }}>
      <motion.div style={{ y, willChange: 'transform' }}>{children}</motion.div>
    </div>
  )
}

/**
 * Mouse-reactive tilt for display scenes. Returns bindings spread onto the
 * scene root plus spring-smoothed transforms for the stage.
 */
export function usePointerTilt(max = 5) {
  const reduced = useReducedMotion()
  const mx = useSpring(0, { stiffness: 160, damping: 20, mass: 0.6 })
  const my = useSpring(0, { stiffness: 160, damping: 20, mass: 0.6 })
  const rotateX = useTransform(my, [-1, 1], [max, -max])
  const rotateY = useTransform(mx, [-1, 1], [-max, max])

  const bind = {
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (reduced) return
      const el = e.currentTarget
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      mx.set(((e.clientX - rect.left) / rect.width - 0.5) * 2)
      my.set(((e.clientY - rect.top) / rect.height - 0.5) * 2)
    },
    onPointerLeave: () => {
      mx.set(0)
      my.set(0)
    },
  }

  return { bind, rotateX, rotateY, reduced }
}
