"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { retryFailedCreditRegistrationsForCourse } from "@/generated/api/sdk.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import { Button, Infobox } from "@/shared-module/components"

import { TONE } from "./constants"
import { refusalSentence } from "./resubmissionRefusal"
import { rowCss, sectionCss } from "./styles"
import { useInvalidateAfterRetry } from "./teacherCreditRegistrations"
import { useActionResult } from "./useActionResult"

interface Props {
  courseId: string
  /** Rows the run would take, from the course summary; the button names it and the confirm repeats it. */
  failedCount: number
}

/** The course-wide retry: it resubmits every permanently failed row, so it says how many and asks first. */
const RetryFailedCreditRegistrationsBlock: React.FC<Props> = ({ courseId, failedCount }) => {
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
      t("credit-registration-bulk-retry-confirm", { count: failedCount }),
      t("credit-registration-bulk-retry-confirm-title"),
      {
        yesButtonLabel: t("button-text-retry-failed-credit-registrations", { count: failedCount }),
      },
    )
    if (confirmed) {
      mutation.mutate(undefined)
    }
  }

  // Nothing to retry and nothing said yet, so the course gets no bulk control at all.
  if (failedCount === 0 && result === null) {
    return null
  }

  return (
    <div className={sectionCss}>
      <div className={rowCss}>
        <Button
          variant="secondary"
          size="medium"
          type="button"
          disabled={failedCount === 0 || mutation.isPending}
          onClick={askAndRetry}
        >
          {t("button-text-retry-failed-credit-registrations", { count: failedCount })}
        </Button>
      </div>
      {result && (
        <Infobox tone={result.retried_count > 0 ? TONE.INFO : TONE.WARNING} announce>
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
