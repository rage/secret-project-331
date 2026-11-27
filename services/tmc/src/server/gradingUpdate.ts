import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER } from "@/shared-module/exercise-protocol/server/exerciseServices"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"
import { createLogger } from "@/util/logger"
import { delay } from "@/util/podExecution"

const { error } = createLogger("grading-update")

/**
 * The host fails a grading whose result has not arrived in this time (`STALE_GRADING_AFTER` in
 * headless-lms' regrader) and discards a later result, so a grading this old is not run.
 */
export const HOST_GIVES_UP_AFTER_MS = 60 * 60_000

const GRADING_UPDATE_ATTEMPTS = 5
const GRADING_UPDATE_RETRY_DELAY_MS = 2000

/**
 * Posts a grading result to the host, retrying because the host commits the pending grading only
 * after /grade has answered, so an early update can find no grading to update. Resolves to whether
 * the host accepted it.
 */
export async function sendGradingUpdate(
  url: string,
  gradingUpdateClaim: string | null,
  result: ExerciseTaskGradingResult,
): Promise<boolean> {
  const headers = omitUndefined({
    "content-type": "application/json",
    [EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER]: gradingUpdateClaim || undefined,
  })
  for (let attempt = 1; attempt <= GRADING_UPDATE_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(result),
      })
      if (res.ok) {
        return true
      }
      error(
        `Grading update attempt ${attempt.toString()} failed: ${res.status.toString()} ${await res.text()}`,
      )
    } catch (e) {
      error(`Grading update attempt ${attempt.toString()} failed: ${String(e)}`)
    }
    if (attempt < GRADING_UPDATE_ATTEMPTS) {
      await delay(GRADING_UPDATE_RETRY_DELAY_MS * attempt)
    }
  }
  error(`Gave up sending a grading update to ${url}`)
  return false
}
