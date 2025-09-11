import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import AllSubmissionsList from "../../components/AllSubmissionsList"
import KeyValueCard from "../../components/KeyValueCard"
import MainFrontedViewSubmission from "../../components/MainFrontedViewSubmission"
import CustomPointsPopup from "../../components/page-specific/manage/exercises/id/submissions/CustomPointsPopup"
import { useExerciseSubmissionsForUser } from "../../hooks/useExerciseSubmissionsForUser"
import { useUserCourseSettings } from "../../hooks/useUserCourseSettings"
import { useUserDetails } from "../../hooks/useUserDetails"
import { fetchSubmissionInfo } from "../../services/backend/submissions"
import { createTeacherGradingDecision } from "../../services/backend/teacher-grading-decisions"

import Button from "@/shared-module/common/components/Button"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import Spinner from "@/shared-module/common/components/Spinner"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"
import { narrowContainerWidthRem } from "@/shared-module/common/styles/constants"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import { courseInstanceUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"
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

  const userDetails = useUserDetails(getSubmissionInfo.data?.exercise_slide_submission.user_id)

  const exerciseSubmissions = useExerciseSubmissionsForUser(
    getSubmissionInfo.data?.exercise.id,
    getSubmissionInfo.data?.exercise_slide_submission.user_id,
  )

  const userCourseSettings = useUserCourseSettings(
    getSubmissionInfo.data?.exercise.course_id,
    getSubmissionInfo.data?.exercise_slide_submission.user_id,
  )

  let userExerciseStateId = getSubmissionInfo.data?.user_exercise_state?.id

  // Get user exercise state for custom points functionality
  const exerciseId = getSubmissionInfo.data?.exercise.id ?? ""

  // Check if current submission is the latest one
  const isLatestSubmission = React.useMemo(() => {
    if (!exerciseSubmissions.data || !getSubmissionInfo.data) {
      return false
    }
    const currentSubmissionId = getSubmissionInfo.data.exercise_slide_submission.id
    const latestSubmission = exerciseSubmissions.data[0] // Submissions are ordered by created_at DESC
    return latestSubmission?.id === currentSubmissionId
  }, [exerciseSubmissions.data, getSubmissionInfo.data])

  // Custom points mutation
  const customPointsMutation = useToastMutation(
    async (points: number) => {
      if (!userExerciseStateId) {
        throw new Error("User exercise state not found")
      }
      return createTeacherGradingDecision({
        user_exercise_state_id: userExerciseStateId,
        exercise_id: exerciseId,
        // eslint-disable-next-line i18next/no-literal-string
        action: "CustomPoints",
        manual_points: points,
        justification: null,
        hidden: false,
      })
    },
    {
      notify: true,
      method: "POST",
    },
  )

  const pointsFromWholeExercise = getSubmissionInfo.data?.user_exercise_state?.score_given
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
          {getSubmissionInfo.data.tasks.some((task) => task.deleted_at !== null) && (
            <GenericInfobox>{t("message-this-task-has-been-deleted")}</GenericInfobox>
          )}

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

          {/* User Information Section */}
          {userDetails.isLoading && <Spinner variant="medium" />}
          {userDetails.isSuccess && (
            <KeyValueCard
              sections={[
                {
                  title: t("submission-details"),
                  items: [
                    {
                      // eslint-disable-next-line i18next/no-literal-string
                      key: "submission-id",
                      label: t("submission-id"),
                      colSpan: 3,
                      value: (
                        <HideTextInSystemTests
                          text={getSubmissionInfo.data.exercise_slide_submission.id}
                          testPlaceholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        />
                      ),
                    },
                    {
                      // eslint-disable-next-line i18next/no-literal-string
                      key: "submission-created",
                      label: t("submission-created"),
                      colSpan: 3,
                      value: dateToString(
                        getSubmissionInfo.data.exercise_slide_submission.created_at,
                      ),
                    },
                    {
                      // eslint-disable-next-line i18next/no-literal-string
                      key: "points",
                      label: t("points"),
                      value: pointsFromWholeExercise,
                      colSpan: 2,
                    },
                    {
                      // eslint-disable-next-line i18next/no-literal-string
                      key: "max-points",
                      label: t("max-points"),
                      value: getSubmissionInfo.data.exercise.score_maximum,
                    },
                  ],
                },
                {
                  title: t("user-information"),
                  items: [
                    {
                      // eslint-disable-next-line i18next/no-literal-string
                      key: "first-name",
                      label: t("first-name"),
                      value: userDetails.data.first_name ?? "",
                    },
                    {
                      // eslint-disable-next-line i18next/no-literal-string
                      key: "last-name",
                      label: t("last-name"),
                      value: userDetails.data.last_name ?? "",
                    },
                    {
                      // eslint-disable-next-line i18next/no-literal-string
                      key: "email",
                      label: t("email"),
                      value: userDetails.data.email ?? "",
                    },
                    {
                      // eslint-disable-next-line i18next/no-literal-string
                      key: "user-id",
                      label: t("user-id"),
                      colSpan: 3,
                      value: (
                        <HideTextInSystemTests
                          text={getSubmissionInfo.data.exercise_slide_submission.user_id}
                          testPlaceholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        />
                      ),
                    },
                  ],
                },
              ]}
              actionButtons={
                userCourseSettings.data?.current_course_instance_id
                  ? [
                      <Link
                        key="course-status"
                        href={courseInstanceUserStatusSummaryRoute(
                          userCourseSettings.data.current_course_instance_id,
                          getSubmissionInfo.data.exercise_slide_submission.user_id,
                        )}
                      >
                        <Button variant="tertiary" size="medium">
                          {t("course-status-summary")}
                        </Button>
                      </Link>,
                    ]
                  : []
              }
            />
          )}

          {/* User Details Error Banner */}
          {userDetails.isError && (
            <ErrorBanner
              variant="readOnly"
              error={userDetails.error}
              className={css`
                max-width: ${narrowContainerWidthRem}rem;
                margin: 0 auto 2rem auto;
              `}
            />
          )}

          {/* Custom Points Section */}
          {getSubmissionInfo.isSuccess && userExerciseStateId && (
            <div
              className={css`
                max-width: ${narrowContainerWidthRem}rem;
                margin: 0 auto 2rem auto;
                padding: 1.5rem;
                background-color: ${baseTheme.colors.clear[100]};
                border-radius: 0.5rem;
                border: 1px solid ${baseTheme.colors.clear[200]};
              `}
            >
              <h3
                className={css`
                  margin: 0 0 1rem 0;
                  color: ${baseTheme.colors.gray[700]};
                  font-size: 1.125rem;
                  font-weight: 600;
                `}
              >
                {t("exercise-grading")}
              </h3>

              {/* Warning for non-current submission */}
              {!isLatestSubmission && (
                <div
                  className={css`
                    margin-bottom: 1rem;
                    padding: 1rem;
                    background-color: ${baseTheme.colors.yellow[100]};
                    border: 1px solid ${baseTheme.colors.yellow[200]};
                    border-radius: 0.25rem;
                  `}
                >
                  <div
                    className={css`
                      display: flex;
                      align-items: center;
                      gap: 0.5rem;
                    `}
                  >
                    <span
                      className={css`
                        font-weight: 600;
                        color: ${baseTheme.colors.gray[700]};
                      `}
                    >
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      {"⚠️"}
                    </span>
                    <span
                      className={css`
                        color: ${baseTheme.colors.gray[700]};
                      `}
                    >
                      {t(
                        "warning-custom-points-non-current-submission",
                        "Warning: This is not the latest submission. Custom points will be applied to the entire exercise, not just this submission.",
                      )}
                    </span>
                  </div>
                </div>
              )}

              <p
                className={css`
                  margin: 0 0 1rem 0;
                  color: ${baseTheme.colors.gray[600]};
                  font-size: 0.875rem;
                  line-height: 1.5;
                `}
              >
                {t(
                  "custom-points-description",
                  "Give custom points for the entire exercise. This will override all previous grading for this exercise.",
                )}
              </p>

              <CustomPointsPopup
                exerciseMaxPoints={getSubmissionInfo.data.exercise.score_maximum}
                onSubmit={(points) => customPointsMutation.mutate(points)}
                longButtonName
              />
            </div>
          )}

          <MainFrontedViewSubmission
            submissionData={getSubmissionInfo.data}
            totalScoreGiven={totalScoreGiven}
          />

          {/* All Submissions by User Section */}
          <AllSubmissionsList
            submissions={exerciseSubmissions.data}
            isLoading={exerciseSubmissions.isLoading}
            isError={exerciseSubmissions.isError}
            error={exerciseSubmissions.error}
            currentSubmissionId={getSubmissionInfo.data.exercise_slide_submission.id}
          />
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
