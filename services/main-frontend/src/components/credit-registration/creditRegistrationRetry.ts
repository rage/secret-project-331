import type { CreditRegistrationAdminAction } from "@/generated/api/types.generated"

import { adminActionLabel } from "./admin/adminCreditRegistrationCopy"
import type { CreditRegistrationTFunction } from "./constants"
import { widenedLookup } from "./labelFrom"

/**
 * Actions whose sentence is worth the row count. The rest record nothing, or a 0/1 that says less
 * than the verb already does.
 */
const COUNTED_ACTION_KEYS = {
  retry_failed_for_course: "credit-registration-action-count-retry-failed-for-course",
  requeue_batch: "credit-registration-action-count-requeue-batch",
  transition_item: "credit-registration-action-count-transition-item",
  unlink_student_number: "credit-registration-action-count-unlink-student-number",
  manual_link_student_number: "credit-registration-action-count-manual-link-student-number",
} as const satisfies Partial<Record<CreditRegistrationAdminAction, string>>

/**
 * What a colleague did, as one past-tense sentence that absorbs the row count.
 *
 * Shares `adminActionLabel`'s complete map, so an action added to the backend enum stops the build
 * here too rather than reaching a teacher's history as its wire name.
 */
export const actionSentence = (
  t: CreditRegistrationTFunction,
  action: CreditRegistrationAdminAction,
  affectedRowCount: number | null | undefined,
): string => {
  const countedKey =
    affectedRowCount === null || affectedRowCount === undefined
      ? undefined
      : widenedLookup(COUNTED_ACTION_KEYS, action)
  return countedKey ? t(countedKey, { count: affectedRowCount }) : adminActionLabel(t, action)
}

export const TEACHER_ACTOR_ROLE = "course_teacher"
