"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useTranslation } from "react-i18next"

import MainFrontedViewSubmission from "@/components/MainFrontedViewSubmission"
import { getSharedSubmissionInfoOptions } from "@/generated/api/@tanstack/react-query.generated"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { narrowContainerWidthRem } from "@/shared-module/common/styles/constants"
import { dateToString } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Infobox, QueryResult } from "@/shared-module/components"

const SharedSubmission: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const { t } = useTranslation()

  const getSharedSubmission = useQuery({
    ...getSharedSubmissionInfoOptions({
      path: {
        token,
      },
    }),
  })
  const title = t(
    getSharedSubmission.data?.is_graded === false ? "title-shared-copy" : "title-shared-submission",
  )
  usePageTitle(getSharedSubmission.data ? title : null)

  return (
    <div
      className={css`
        max-width: ${narrowContainerWidthRem}rem;
        margin: 0 auto;
      `}
    >
      <QueryResult
        query={getSharedSubmission}
        renderBlockingError={() => <Infobox>{t("message-shared-submission-not-found")}</Infobox>}
      >
        {(submissionInfo) => {
          const totalScoreGiven = submissionInfo.tasks
            .map((task) => task.previous_submission_grading?.score_given)
            .reduce((a, b) => (a ?? 0) + (b ?? 0), 0)

          const exerciseName = (
            <HideTextInSystemTests text={submissionInfo.exercise.name} testPlaceholder={title} />
          )

          return (
            <>
              <div
                className={css`
                  font-size: 1.1rem;
                  margin-bottom: 0.25rem;
                `}
              >
                {title}
              </div>
              <h1
                className={css`
                  margin-bottom: 0.25rem;
                  overflow-wrap: anywhere;
                `}
              >
                {submissionInfo.exercise_page_url ? (
                  <a href={submissionInfo.exercise_page_url}>{exerciseName}</a>
                ) : (
                  exerciseName
                )}
              </h1>
              <p
                className={css`
                  margin-bottom: 2rem;
                  opacity: 0.8;
                `}
              >
                {t(
                  submissionInfo.is_graded
                    ? "shared-submission-submitted-at"
                    : "shared-submission-saved-at",
                  { time: dateToString(submissionInfo.created_at) },
                )}
              </p>

              {!submissionInfo.is_graded && (
                <Infobox data-testid="shared-submission-not-graded">
                  {t("shared-submission-not-graded")}
                </Infobox>
              )}

              <MainFrontedViewSubmission
                submissionData={submissionInfo}
                totalScoreGiven={totalScoreGiven}
                isGraded={submissionInfo.is_graded}
              />
            </>
          )
        }}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(SharedSubmission))
