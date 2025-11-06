/**
 * Queue ID for exercise task iframe rendering throttle.
 * All ExerciseTaskIframe instances sharing this qid will use the same queue.
 */
export const EXERCISE_IFRAME_QUEUE_ID = "exercise-task-iframes"

/**
 * Configuration for exercise task iframe rendering throttle.
 * When a participant exceeds maxHoldMs, they are demoted (freed slot) but continue running.
 */
export const EXERCISE_IFRAME_QUEUE_CONFIG = {
  capacity: 3,
  maxHoldMs: 1000,
}
