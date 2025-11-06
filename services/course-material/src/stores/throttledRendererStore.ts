/**
 * Queue ID for exercise task iframe rendering throttle.
 * All ExerciseTaskIframe instances sharing this qid will use the same queue.
 */
export const EXERCISE_IFRAME_QUEUE_ID = "exercise-task-iframes"

/**
 * Configuration for exercise task iframe rendering throttle.
 * - capacity: 1 (requirement #2 - default concurrency)
 * - maxHoldMs: 10_000 (requirement #4 - timeout protection, 10 seconds)
 *   When a participant exceeds maxHoldMs, they are demoted (freed slot) but continue running.
 */
export const EXERCISE_IFRAME_QUEUE_CONFIG = {
  capacity: 3,
  maxHoldMs: 1000,
}

/**
 * Deprecated: kept for backwards compatibility during migration.
 * The queue is now managed internally by useConcurrencyThrottle hook.
 */
export const exerciseTaskIframeQueueAtom = null
