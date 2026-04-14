"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { groupBy } from "lodash"
import Link from "next/link"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import CourseInstanceProgressSection from "@/app/manage/course-instances/[id]/points/user_id/CourseInstanceProgressSection"
import CourseInstanceUserInfoBox from "@/app/manage/course-instances/[id]/points/user_id/CourseInstanceUserInfoBox"
import CourseModuleCompletionsSection from "@/app/manage/course-instances/[id]/points/user_id/CourseModuleCompletionsSection"
import ExerciseListSection from "@/app/manage/course-instances/[id]/points/user_id/ExerciseListSection"
import { getCourseStudentsProgressOptions } from "@/generated/api/@tanstack/react-query.generated"
import { useExerciseStatusSummaries } from "@/hooks/useExerciseStatusSummaries"
import DataLoadError from "@/shared-module/common/components/DataLoadError"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { courseExerciseResetToolRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { TeacherChapterLockStatus } from "@/utils/chapterLockingStatus"

const CourseExerciseStatusList: React.FC = () => {
  const { t } = useTranslation()
  const { id, user_id } = useParams<{ id: string; user_id: string }>()

  const exerciseStatusSummariesQuery = useExerciseStatusSummaries(id, user_id)
  const progressQuery = useQuery(
    getCourseStudentsProgressOptions({
      path: {
        course_id: id,
      },
    }),
  )

  if (exerciseStatusSummariesQuery.isError) {
    return <ErrorBanner variant={"readOnly"} error={exerciseStatusSummariesQuery.error} />
  }

  if (exerciseStatusSummariesQuery.isLoading) {
    return <Spinner variant="medium" />
  }

  if (!exerciseStatusSummariesQuery.data) {
    return (
      <DataLoadError
        onRetry={() => {
          void exerciseStatusSummariesQuery.refetch()
        }}
      />
    )
  }

  const groupedByChapter = Object.entries(
    groupBy(
      exerciseStatusSummariesQuery.data,
      (exerciseStatus) => exerciseStatus.exercise.chapter_id,
    ),
  )
  type UserChapterLockStatusRow = {
    user_id: string
    chapter_id: string
    status: TeacherChapterLockStatus
  }
  const chapterLockStatuses = (
    (
      progressQuery.data as
        | (typeof progressQuery.data & {
            user_chapter_locking_statuses?: UserChapterLockStatusRow[]
          })
        | undefined
    )?.user_chapter_locking_statuses ?? []
  )
    .filter((lockStatus) => lockStatus.user_id === user_id)
    .reduce<Record<string, TeacherChapterLockStatus>>((acc, lockStatus) => {
      acc[lockStatus.chapter_id] = lockStatus.status
      return acc
    }, {})

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
        chapterLockStatusesByChapterId={chapterLockStatuses}
      />
      {Object.keys(chapterLockStatuses).length === 0 && (
        <p data-testid="teacher-chapter-lock-status-empty">
          {t("teacher-chapter-lock-status-empty")}
        </p>
      )}
      <Link href={courseExerciseResetToolRoute(id, user_id)}>{t("title-reset-exercises")}</Link>
    </>
  )
}

export default withErrorBoundary(withSignedIn(CourseExerciseStatusList))
