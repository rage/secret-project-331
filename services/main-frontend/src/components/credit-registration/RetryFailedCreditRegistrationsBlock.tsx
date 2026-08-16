"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { retryFailedCreditRegistrationsForCourse } from "@/generated/api/sdk.generated"
import type { RetryFailedCreditRegistrationsResult } from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button, Infobox } from "@/shared-module/components"

import { TONE } from "./constants"
import { retryOutcomeSentence } from "./creditRegistrationRetry"

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
  const [result, setResult] = useState<RetryFailedCreditRegistrationsResult | null>(null)
  const queryClient = useQueryClient()

  const mutation = useToastMutation(
    () => retryFailedCreditRegistrationsForCourse({ path: { course_id: courseId }, body: {} }),
    { notify: false },
    {
      onSuccess: (data) => {
        setResult(data)
        queryClient.invalidateQueries()
      },
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
