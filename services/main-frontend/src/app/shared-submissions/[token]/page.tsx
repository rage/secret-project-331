"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import MainFrontedViewSubmission from "@/components/MainFrontedViewSubmission"
import { getSharedSubmissionInfoOptions } from "@/generated/api/@tanstack/react-query.generated"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { narrowContainerWidthRem } from "@/shared-module/common/styles/constants"
import { dateToString } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Breadcrumbs, type BreadcrumbItem, Infobox, QueryResult } from "@/shared-module/components"

const SharedSubmission: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const { t } = useTranslation()
  usePageTitle(t("title-shared-submission"))

  const getSharedSubmission = useQuery({
    ...getSharedSubmissionInfoOptions({
      path: {
        token,
      },
    }),
  })

  const items: BreadcrumbItem[] = useMemo(() => [{ label: t("title-shared-submission") }], [t])

  return (
    <div
      className={css`
        max-width: ${narrowContainerWidthRem}rem;
        margin: 0 auto;
      `}
    >
      <Breadcrumbs items={items} />
      <QueryResult
        query={getSharedSubmission}
        renderBlockingError={() => <Infobox>{t("message-shared-submission-not-found")}</Infobox>}
      >
        {(submissionInfo) => {
          const totalScoreGiven = submissionInfo.tasks
            .map((task) => task.previous_submission_grading?.score_given)
            .reduce((a, b) => (a ?? 0) + (b ?? 0), 0)

          return (
            <>
              <h1
                className={css`
                  margin-bottom: 0.25rem;
                `}
              >
                {t("title-shared-submission")}
              </h1>
              <div
                className={css`
                  font-size: 1.1rem;
                  margin-bottom: 0.25rem;
                `}
              >
                <HideTextInSystemTests
                  text={submissionInfo.exercise.name}
                  testPlaceholder={t("title-shared-submission")}
                />
              </div>
              <p
                className={css`
                  margin-bottom: 2rem;
                  opacity: 0.8;
                `}
              >
                {t("shared-submission-submitted-at", {
                  time: dateToString(submissionInfo.exercise_slide_submission.created_at),
                })}
              </p>

              <MainFrontedViewSubmission
                submissionData={submissionInfo}
                totalScoreGiven={totalScoreGiven}
              />
            </>
          )
        }}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(SharedSubmission))
