import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { Question } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import SubmissionIFrame from "../../components/page-specific/submissions/id/SubmissionIFrame"
import { fetchSubmissionInfo } from "../../services/backend/submissions"

import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import Spinner from "@/shared-module/common/components/Spinner"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { baseTheme } from "@/shared-module/common/styles"
import { narrowContainerWidthRem } from "@/shared-module/common/styles/constants"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import { dateToString } from "@/shared-module/common/utils/time"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}

const Submission: React.FC<React.PropsWithChildren<SubmissionPageProps>> = ({ query }) => {
  const { t } = useTranslation()
  const getSubmissionInfo = useQuery({
    queryKey: [`submission-${query.id}`],
    queryFn: () => fetchSubmissionInfo(query.id),
  })

  const totalScoreGiven = getSubmissionInfo.data?.tasks
    .map((task) => task.previous_submission_grading?.score_given)
    .reduce((a, b) => (a ?? 0) + (b ?? 0), 0)
  return (
    <div>
      {getSubmissionInfo.isError && (
        <ErrorBanner variant={"readOnly"} error={getSubmissionInfo.error} />
      )}
      {getSubmissionInfo.isPending && <Spinner variant={"medium"} />}
      {getSubmissionInfo.isSuccess && (
        <>
          <h1
            className={css`
              margin-bottom: 2rem;
            `}
          >
            <HideTextInSystemTests
              text={t("title-submission-id", { id: query.id })}
              testPlaceholder={t("title-submission-id", {
                id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
              })}
            />
          </h1>

          {
            <div
              className={css`
                background-color: ${baseTheme.colors.green[600]};
                color: ${baseTheme.colors.clear[100]};
                padding: 1.5rem 2rem;
                max-width: ${narrowContainerWidthRem}rem;
                margin: 2rem auto;
                display: flex;
                align-items: center;
              `}
            >
              <div
                aria-hidden
                className={css`
                  background-color: ${baseTheme.colors.clear[100]};
                  color: ${baseTheme.colors.green[600]};
                  font-weight: bold;
                  font-size: 42px;
                  width: 58px;
                  height: 58px;
                  border-radius: 100%;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                `}
              >
                <Question />
              </div>
              <div
                className={css`
                  flex: 1;
                  margin-left: 1rem;
                `}
              >
                <div>
                  <HideTextInSystemTests
                    text={t("answered-at", {
                      time: dateToString(
                        getSubmissionInfo.data.exercise_slide_submission.created_at,
                      ),
                    })}
                    testPlaceholder={t("answered-at", {
                      time: "XXXX-XX-XX XX:XX:XX UTC+00:00",
                    })}
                  />
                </div>
                <div>
                  <HideTextInSystemTests
                    text={t("sent-by", {
                      user: getSubmissionInfo.data.exercise_slide_submission.user_id,
                    })}
                    testPlaceholder={t("sent-by", {
                      user: "user",
                    })}
                  />
                </div>
              </div>
              <div
                className={css`
                  font-weight: bold;
                  font-size: 18px;
                  text-transform: uppercase;
                `}
              >
                {t("points")} {totalScoreGiven} / {getSubmissionInfo.data.exercise.score_maximum}
              </div>
            </div>
          }
          {getSubmissionInfo.data.tasks
            .sort((a, b) => a.order_number - b.order_number)
            .map((task) => (
              <div key={task.id}>
                <SubmissionIFrame coursematerialExerciseTask={task} />
                {task.deleted_at !== null && (
                  <GenericInfobox>{t("message-this-task-has-been-deleted")}</GenericInfobox>
                )}
              </div>
            ))}
        </>
      )}
      <div
        className={css`
          background-color: ${baseTheme.colors.clear[100]};
          color: ${baseTheme.colors.clear[100]};
          padding: 1.5rem 2rem;
          max-width: ${narrowContainerWidthRem}rem;
          margin: 2rem auto;
          display: flex;
          align-items: center;
        `}
      >
        <div
          className={css`
            flex: 1;
          `}
        ></div>
        <DebugModal data={getSubmissionInfo.data} />
      </div>
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(Submission)
