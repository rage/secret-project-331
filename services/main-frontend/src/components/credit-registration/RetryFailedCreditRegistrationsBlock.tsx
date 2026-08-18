"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { retryFailedCreditRegistrationsForCourse } from "@/generated/api/sdk.generated"
import { Button, Infobox } from "@/shared-module/components"

import { TONE } from "./constants"
import { retryOutcomeSentence } from "./creditRegistrationRetry"
import { useInvalidateAfterRetry } from "./teacherCreditRegistrations"
import { useActionResult } from "./useActionResult"

interface Props {
  courseId: string
}

const resultCss = css`
  display: grid;
  gap: 0.25rem;
  width: 100%;
`

const RetryFailedCreditRegistrationsBlock: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()
  const invalidateAfterRetry = useInvalidateAfterRetry(courseId)

  const { result, mutation } = useActionResult(
    () => retryFailedCreditRegistrationsForCourse({ path: { course_id: courseId }, body: {} }),
    async () => {
      await invalidateAfterRetry()
    },
  )

  return (
    <>
      <Button
        variant="secondary"
        size="medium"
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(undefined)}
      >
        {t("button-text-retry-failed-credit-registrations")}
      </Button>
      {result && (
        <Infobox tone={result.retried_count > 0 ? TONE.INFO : TONE.WARNING} announce>
          <div className={resultCss}>
            <div>
              {t("credit-registration-bulk-retry-retried", { count: result.retried_count })}
            </div>
            {result.skipped.map((skip) => (
              <div key={skip.outcome}>
                {t("credit-registration-bulk-retry-skipped", {
                  count: skip.count,
                  reason: retryOutcomeSentence(t, skip.outcome),
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
    </>
  )
}

export default RetryFailedCreditRegistrationsBlock
