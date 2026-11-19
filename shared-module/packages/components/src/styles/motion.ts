/**
 * Motion durations and easings, as JS values.
 *
 * `tokens.ts` interpolates these into the `--duration-*` / `--ease-*` custom properties, so CSS
 * and `motion/react` variants and `setTimeout` delays share one definition instead of drifting.
 */

/** Interaction durations, ms, from a colour-only flip up to the modal's arrival. */
export const DURATION_MS = {
  instant: 80,
  fast: 140,
  base: 200,
  slow: 280,
  deliberate: 360,
} as const

/** Indeterminate loop durations, ms: one spinner revolution, one shimmer sweep, one progress-beam pass. */
export const LOOP_DURATION_MS = {
  spin: 900,
  shimmer: 1600,
  progressBeam: 1100,
} as const

export const EASING = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  entrance: "cubic-bezier(0.05, 0.7, 0.1, 1)",
  exit: "cubic-bezier(0.3, 0, 0.8, 0.15)",
  linear: "linear",
} as const

/** A pending operation may run this long before a loading affordance may appear; below it, a spinner reads as a glitch. */
export const LOADING_AFFORDANCE_DELAY_MS = 250

/** Once a loading affordance is shown, it stays visible at least this long so a fast resolve does not blink. */
export const MIN_VISIBLE_MS = 400
