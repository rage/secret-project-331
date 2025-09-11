import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import AllSubmissionsList from "../../components/AllSubmissionsList"
import KeyValueCard from "../../components/KeyValueCard"
import MainFrontedViewSubmission from "../../components/MainFrontedViewSubmission"
import { useExerciseSubmissionsForUser } from "../../hooks/useExerciseSubmissionsForUser"
import { useUserCourseSettings } from "../../hooks/useUserCourseSettings"
import { useUserDetails } from "../../hooks/useUserDetails"
import { fetchSubmissionInfo } from "../../services/backend/submissions"

import Button from "@/shared-module/common/components/Button"
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
                      value: totalScoreGiven,
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
