"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import AllSubmissionsList from "@/components/AllSubmissionsList"
import DeletedUserNotice from "@/components/DeletedUserNotice"
import ExerciseGradingCard from "@/components/ExerciseGradingCard"
import KeyValueCard from "@/components/KeyValueCard"
import MainFrontedViewSubmission from "@/components/MainFrontedViewSubmission"
import { useExerciseSubmissionsForUser } from "@/hooks/useExerciseSubmissionsForUser"
import { useUserCourseSettings } from "@/hooks/useUserCourseSettings"
import { extractUserDetail, isUserDetailsNotFound, useUserDetails } from "@/hooks/useUserDetails"
import { fetchSubmissionInfo } from "@/services/backend/submissions"
import Breadcrumbs from "@/shared-module/common/components/Breadcrumbs"
import Button from "@/shared-module/common/components/Button"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import Spinner from "@/shared-module/common/components/Spinner"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { narrowContainerWidthRem } from "@/shared-module/common/styles/constants"
import {
  courseUserStatusSummaryRoute,
  exerciseSubmissionsRoute,
} from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const Submission: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const getSubmissionInfo = useQuery({
    queryKey: [`submission-${id}`],
    queryFn: () => fetchSubmissionInfo(id),
  })

  const userDetails = useUserDetails(
    getSubmissionInfo.data?.exercise.course_id ? [getSubmissionInfo.data.exercise.course_id] : null,
    getSubmissionInfo.data?.exercise_slide_submission.user_id,
  )
  const user = extractUserDetail(userDetails.data)
  const userDetailsNotFound = isUserDetailsNotFound(userDetails.data)

  const exerciseSubmissions = useExerciseSubmissionsForUser(
    getSubmissionInfo.data?.exercise.id,
    getSubmissionInfo.data?.exercise_slide_submission.user_id,
  )

  const userCourseSettings = useUserCourseSettings(
    getSubmissionInfo.data?.exercise.course_id,
    getSubmissionInfo.data?.exercise_slide_submission.user_id,
  )

  // Callback to refetch all queries when grading is submitted
  const handleGradingSubmit = React.useCallback(() => {
    getSubmissionInfo.refetch()
    userDetails.refetch()
    exerciseSubmissions.refetch()
    userCourseSettings.refetch()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  let userExerciseStateId = getSubmissionInfo.data?.user_exercise_state?.id

  // Get user exercise state for custom points functionality
  const exerciseId = getSubmissionInfo.data?.exercise.id ?? ""

  // Check if current submission is the latest one
  const isLatestSubmission = React.useMemo(() => {
    if (!exerciseSubmissions.data || !getSubmissionInfo.data) {
      return false
    }
    const currentSubmissionId = getSubmissionInfo.data.exercise_slide_submission.id
    // Sort submissions by created_at DESC to get the latest one
    const sortedSubmissions = [...exerciseSubmissions.data].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    const latestSubmission = sortedSubmissions[0]
    return latestSubmission?.id === currentSubmissionId
  }, [exerciseSubmissions.data, getSubmissionInfo.data])
  const pointsFromWholeExercise = getSubmissionInfo.data?.user_exercise_state?.score_given
  const totalScoreGiven = getSubmissionInfo.data?.tasks
    .map((task) => task.previous_submission_grading?.score_given)
    .reduce((a, b) => (a ?? 0) + (b ?? 0), 0)

  // Construct breadcrumb pieces
  const breadcrumbPieces = React.useMemo(() => {
    if (!getSubmissionInfo.data) {
      return []
    }

    return [
      {
        text: t("header-submissions"),
        url: exerciseSubmissionsRoute(getSubmissionInfo.data.exercise.id),
      },
      {
        text: t("title-submission-id", { id }),
        // eslint-disable-next-line i18next/no-literal-string
        url: `/submissions/${id}`,
      },
    ]
  }, [getSubmissionInfo.data, id, t])

  return (
    <div>
      {getSubmissionInfo.isError && (
        <ErrorBanner variant={"readOnly"} error={getSubmissionInfo.error} />
      )}
      {getSubmissionInfo.isLoading && <Spinner variant={"medium"} />}
      {getSubmissionInfo.isSuccess && breadcrumbPieces.length > 0 && (
        <Breadcrumbs pieces={breadcrumbPieces} />
      )}
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
              text={t("title-submission-id", { id })}
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
                      label: t("points-from-whole-exercise"),
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
                ...(user
                  ? [
                      {
                        title: t("user-information"),
                        items: [
                          {
                            // eslint-disable-next-line i18next/no-literal-string
                            key: "first-name",
                            label: t("first-name"),
                            value: user.first_name,
                          },
                          {
                            // eslint-disable-next-line i18next/no-literal-string
                            key: "last-name",
                            label: t("last-name"),
                            value: user.last_name,
                          },
                          {
                            // eslint-disable-next-line i18next/no-literal-string
                            key: "email",
                            label: t("email"),
                            value: user.email,
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
                    ]
                  : []),
              ]}
              actionButtons={
                getSubmissionInfo.data?.exercise.course_id
                  ? [
                      <Link
                        key="course-status"
                        href={courseUserStatusSummaryRoute(
                          getSubmissionInfo.data.exercise.course_id,
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

          {userDetails.isSuccess && userDetailsNotFound && (
            <DeletedUserNotice
              userId={getSubmissionInfo.data.exercise_slide_submission.user_id}
              className={css`
                max-width: ${narrowContainerWidthRem}rem;
                margin: 0 auto 2rem auto;
              `}
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

      {getSubmissionInfo.isSuccess && userExerciseStateId && (
        <ExerciseGradingCard
          userExerciseStateId={userExerciseStateId}
          exerciseId={exerciseId}
          exerciseMaxPoints={getSubmissionInfo.data.exercise.score_maximum}
          isLatestSubmission={isLatestSubmission}
          onGradingSubmit={handleGradingSubmit}
        />
      )}

      <div
        className={css`
          background-color: #f8f9fa;
          color: #f8f9fa;
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

export default withErrorBoundary(Submission)
