import type { LoadSlotConfig } from "@/shared-module/common/hooks/useLoadSlot"

/** Queue shared by every exercise task iframe on the page, so they are throttled together. */
export const EXERCISE_IFRAME_QUEUE_ID = "exercise-task-iframes"

/** Load slot limits for exercise task iframes; mirrored in `exercise-iframe-resilience.spec.ts`. */
export const EXERCISE_IFRAME_QUEUE_CONFIG: LoadSlotConfig = {
  capacity: 3,
  maxHoldMs: 8000,
}
