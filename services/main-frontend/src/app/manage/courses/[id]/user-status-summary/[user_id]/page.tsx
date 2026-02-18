"use client"

import { css } from "@emotion/css"
import { groupBy } from "lodash"
import Link from "next/link"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import CourseInstanceProgressSection from "@/app/manage/course-instances/[id]/points/user_id/CourseInstanceProgressSection"
import CourseInstanceUserInfoBox from "@/app/manage/course-instances/[id]/points/user_id/CourseInstanceUserInfoBox"
import CourseModuleCompletionsSection from "@/app/manage/course-instances/[id]/points/user_id/CourseModuleCompletionsSection"
import ExerciseListSection from "@/app/manage/course-instances/[id]/points/user_id/ExerciseListSection"
import { useExerciseStatusSummaries } from "@/hooks/useExerciseStatusSummaries"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { courseExerciseResetToolRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const CourseExerciseStatusList: React.FC = () => {
  const { t } = useTranslation()
  const { id, user_id } = useParams<{ id: string; user_id: string }>()

  const exerciseStatusSummariesQuery = useExerciseStatusSummaries(id, user_id)

  if (exerciseStatusSummariesQuery.isError) {
    return <ErrorBanner variant={"readOnly"} error={exerciseStatusSummariesQuery.error} />
  }

  if (exerciseStatusSummariesQuery.isLoading || !exerciseStatusSummariesQuery.data) {
    return <Spinner variant="medium" />
  }

  const groupedByChapter = Object.entries(
    groupBy(
      exerciseStatusSummariesQuery.data,
      (exerciseStatus) => exerciseStatus.exercise.chapter_id,
    ),
  )

  return (
    <>
      <h1
        className={css`
          margin-bottom: 2rem;
        `}
      >
        {t("course-status-summary")}
      </h1>
      <CourseInstanceUserInfoBox courseId={id} courseInstanceId="" userId={user_id} />
      <CourseModuleCompletionsSection userId={user_id} courseId={id} />
      <CourseInstanceProgressSection userId={user_id} courseId={id} />
      <ExerciseListSection
        groupedByChapter={groupedByChapter}
        courseId={id}
        onPointsUpdate={exerciseStatusSummariesQuery.refetch}
      />
      <Link href={courseExerciseResetToolRoute(id, user_id)}>{t("title-reset-exercises")}</Link>
    </>
  )
}

export default withErrorBoundary(withSignedIn(CourseExerciseStatusList))
