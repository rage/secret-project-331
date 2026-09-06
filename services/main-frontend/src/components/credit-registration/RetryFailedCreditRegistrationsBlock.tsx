"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { retryFailedCreditRegistrationsForCourse } from "@/generated/api/sdk.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import { Button, Infobox } from "@/shared-module/components"

import { BUTTON_PRIMARY, TONE } from "./constants"
import { refusalSentence } from "./resubmissionRefusal"
import { sectionCss } from "./styles"
import { useInvalidateAfterRetry } from "./teacherCreditRegistrations"
import { useActionResult } from "./useActionResult"

interface Props {
  courseId: string
  /**
   * Failures a resubmission could actually clear, from `useCourseFailureReasons`. Not the failure
   * total: most failures on a real course need a setting changed, the student, or support, and
   * sending those again fails them the same way.
   */
  retryableCount: number
  /** Whether any enabled module is paused, in which case nothing this button sends will move. */
  isAnyModulePaused: boolean
}

/**
 * The course-wide retry: the action of the "worth sending again" failure group.
 *
 * Only ever names the failures Sisu might take on a second try, and stands down — with an
 * explanation in place of a ghosted button — while a pause is holding the course.
 */
const RetryFailedCreditRegistrationsBlock: React.FC<Props> = ({
  courseId,
  retryableCount,
  isAnyModulePaused,
}) => {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const invalidateAfterRetry = useInvalidateAfterRetry(courseId)

  const { result, mutation } = useActionResult(
    () => retryFailedCreditRegistrationsForCourse({ path: { course_id: courseId }, body: {} }),
    async () => {
      await invalidateAfterRetry()
    },
  )

  const askAndRetry = async () => {
    const confirmed = await confirm(
      t("credit-registration-bulk-retry-confirm", { count: retryableCount }),
      t("credit-registration-bulk-retry-confirm-title"),
      {
        yesButtonLabel: t("button-text-retry-failed-credit-registrations", {
          count: retryableCount,
        }),
      },
    )
    if (confirmed) {
      mutation.mutate(undefined)
    }
  }

  const hasButton = retryableCount > 0 || result !== null

  return (
    <div className={sectionCss}>
      {hasButton && isAnyModulePaused && (
        <Infobox tone={TONE.WARNING}>{t("credit-registration-retry-blocked-by-pause")}</Infobox>
      )}
      {hasButton && !isAnyModulePaused && (
        <Button
          variant={BUTTON_PRIMARY}
          size="medium"
          type="button"
          disabled={retryableCount === 0 || mutation.isPending}
          onClick={askAndRetry}
        >
          {t("button-text-retry-failed-credit-registrations", { count: retryableCount })}
        </Button>
      )}
      {result && (
        <Infobox tone={result.retried_count > 0 ? TONE.SUCCESS : TONE.WARNING} announce>
          <div className={sectionCss}>
            <div>
              {t("credit-registration-bulk-retry-retried", { count: result.retried_count })}
            </div>
            {result.skipped.map((skip) => (
              <div key={skip.refusal}>
                {t("credit-registration-bulk-retry-skipped", {
                  count: skip.count,
                  reason: refusalSentence(t, skip.refusal),
                })}
              </div>
            ))}
            {result.more_rows_remaining && (
              <div>
                {t("credit-registration-bulk-retry-more-remaining", {
                  max: result.max_rows_per_call,
                })}
              </div>
            )}
          </div>
        </Infobox>
      )}
    </div>
  )
}

export default RetryFailedCreditRegistrationsBlock
