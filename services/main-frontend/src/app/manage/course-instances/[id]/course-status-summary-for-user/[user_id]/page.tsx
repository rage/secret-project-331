"use client"

import { css } from "@emotion/css"
import { groupBy } from "lodash"
import Link from "next/link"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import CourseInstanceProgressSection from "@/components/page-specific/manage/course-instances/id/points/user_id/CourseInstanceProgressSection"
import CourseInstanceUserInfoBox from "@/components/page-specific/manage/course-instances/id/points/user_id/CourseInstanceUserInfoBox"
import CourseModuleCompletionsSection from "@/components/page-specific/manage/course-instances/id/points/user_id/CourseModuleCompletionsSection"
import ExerciseListSection from "@/components/page-specific/manage/course-instances/id/points/user_id/ExerciseListSection"
import { useCourseIdFromExerciseStatus } from "@/hooks/useCourseIdFromExerciseStatus"
import { useExerciseStatusSummaries } from "@/hooks/useExerciseStatusSummaries"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const CourseInstanceExerciseStatusList: React.FC = () => {
  const { t } = useTranslation()
  const { id, user_id } = useParams<{ id: string; user_id: string }>()

  const exerciseStatusSummariesQuery = useExerciseStatusSummaries(id, user_id)
  const courseId = useCourseIdFromExerciseStatus(exerciseStatusSummariesQuery.data)

  if (exerciseStatusSummariesQuery.isError) {
    return <ErrorBanner variant={"readOnly"} error={exerciseStatusSummariesQuery.error} />
  }

  if (exerciseStatusSummariesQuery.isLoading || !exerciseStatusSummariesQuery.data || !courseId) {
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
      <CourseInstanceUserInfoBox courseId={courseId} courseInstanceId={id} userId={user_id} />
      <CourseModuleCompletionsSection courseInstanceId={id} userId={user_id} courseId={courseId} />
      <CourseInstanceProgressSection courseInstanceId={id} userId={user_id} courseId={courseId} />
      <ExerciseListSection
        groupedByChapter={groupedByChapter}
        courseId={courseId}
        onPointsUpdate={exerciseStatusSummariesQuery.refetch}
      />
      <Link href={`/manage/courses/${courseId}/other/exercise-reset-tool?user_id=${user_id}`}>
        {t("title-reset-exercises")}
      </Link>
    </>
  )
}

export default withErrorBoundary(withSignedIn(CourseInstanceExerciseStatusList))
