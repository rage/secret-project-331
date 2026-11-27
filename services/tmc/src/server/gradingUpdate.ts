import { EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER } from "@/shared-module/exercise-protocol/server/exerciseServices"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"
import { createLogger } from "@/util/logger"
import { delay } from "@/util/podExecution"

const { error } = createLogger("grading-update")

const GRADING_UPDATE_ATTEMPTS = 5
const GRADING_UPDATE_RETRY_DELAY_MS = 2000

/**
 * Posts a grading result to the host, retrying because the host commits the pending grading only
 * after /grade has answered, so an early update can find no grading to update.
 */
export async function sendGradingUpdate(
  url: string,
  gradingUpdateClaim: string | null,
  result: ExerciseTaskGradingResult,
): Promise<void> {
  const headers = {
    "content-type": "application/json",
    ...(gradingUpdateClaim && {
      [EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER]: gradingUpdateClaim,
    }),
  }
  for (let attempt = 1; attempt <= GRADING_UPDATE_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(result),
      })
      if (res.ok) {
        return
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
}
