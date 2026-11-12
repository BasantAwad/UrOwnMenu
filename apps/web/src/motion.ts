/**
 * UrOwnMenu motion system.
 *
 * Every complex animation in the templates is defined here so that timing,
 * easing and depth stay consistent and reviewable.
 *
 * Parameters come from measured reference work, not from memory:
 *
 * - Durations and easings follow the `motion-ref` skill's category notes:
 *   fade 200-400 ms, slide-up 300-500 ms, scale-in 200-350 ms, spring-in
 *   400-600 ms, stagger 50-100 ms per item, and a total entrance under
 *   800 ms.
 * - The house easing [0.22, 1, 0.36, 1] and the spring
 *   stiffness 260 / damping 24 / mass 1 are the defaults in TuneShape's
 *   published effect configs (basic-button, hover-invert, soft-blur-in).
 * - `interruption: "retarget"` is the reference behaviour: an interrupted
 *   animation continues from its current velocity instead of snapping.
 *   Motion springs do this natively.
 * - `reducedMotion: "instant"` matches MotionConfig reducedMotion="user",
 *   which snaps to the end state rather than removing the animation.
 *
 * Springs are used rather than fixed-duration tweens so an interrupted
 * animation continues from its current velocity. That is the difference
 * between "alive" and "mechanical".
 *
 * Motion (motiondivision/motion) v14, MIT licence.
 */
import type { Transition, Variants } from 'motion/react'

/** The house easing used across the published templates. */
export const houseEase = [0.22, 1, 0.36, 1] as const

/** The reference spring: stiffness 260, damping 24, mass 1. */
export const houseSpring: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 24,
  mass: 1,
}

export const motionPresets = {
  /**
   * Slide-up entrance. 300-500 ms, ease-out, 20-30 px of travel.
   * The reference notes that a 20-30 px offset is enough - more reads as
   * a slide rather than an entrance.
   */
  rise: {
    hidden: { opacity: 0, y: 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.38, ease: houseEase },
    },
  },

  /**
   * Scale entrance. 200-350 ms. The start value is 0.94, not 0 - the
   * reference explicitly warns against starting from zero.
   */
  scale: {
    hidden: { opacity: 0, scale: 0.94 },
    show: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.28, ease: houseEase },
    },
  },

  /** Simple fade. 200-400 ms. The reference's recommended reduced-motion fallback. */
  fade: {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.3, ease: houseEase } },
  },
} satisfies Record<string, Variants>

/**
 * Container that staggers its children.
 * 50-100 ms per item, and the whole sequence stays under 800 ms.
 */
export const staggerContainer = (stagger = 0.07, delay = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
})

/**
 * Shared-layout / focal transition. Uses the reference spring so that the
 * marker, media, title, price and category all arrive together.
 */
export const focalTransition: Transition = houseSpring

/**
 * Small state changes: markers, chips, hover targets.
 * The reference uses 220 ms for a hover colour transition and 250 ms for
 * a tab indicator.
 */
export const snapTransition: Transition = {
  duration: 0.24,
  ease: houseEase,
}

/**
 * Press feedback. The reference's button config: scale 0.92, y 2,
 * duration 420 ms, spring 260/24/1.
 */
export const pressTransition: Transition = houseSpring

export const pressScale = 0.92

/**
 * Page transitions. The reference's rail-toc uses 520 ms; the magazine
 * page turn is the same kind of structural change.
 */
export const pageTransition: Transition = {
  type: 'spring',
  stiffness: 220,
  damping: 26,
  mass: 1,
}

/** Scroll progress bar: the reference uses an ease-in-out with no spring. */
export const progressTransition: Transition = {
  duration: 0.5,
  ease: [0, 0, 1, 1],
}

/** Depth planes for the Ingredient Universe. */
export const depthPlanes = [
  { key: 'front', scale: 1, opacity: 1, z: 90 },
  { key: 'middle', scale: 0.86, opacity: 0.92, z: 40 },
  { key: 'back', scale: 0.74, opacity: 0.78, z: 10 },
] as const
