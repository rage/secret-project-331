"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { groupBy } from "lodash"
import Link from "next/link"
import { useParams } from "next/navigation"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import CourseInstanceProgressSection from "@/app/manage/course-instances/[id]/points/user_id/CourseInstanceProgressSection"
import CourseInstanceUserInfoBox from "@/app/manage/course-instances/[id]/points/user_id/CourseInstanceUserInfoBox"
import CourseModuleCompletionsSection from "@/app/manage/course-instances/[id]/points/user_id/CourseModuleCompletionsSection"
import ExerciseListSection from "@/app/manage/course-instances/[id]/points/user_id/ExerciseListSection"
import {
  getCourseStudentChapterLockingStatusesOptions,
  teacherSetStudentChapterStatusMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import { useCourseQuery } from "@/hooks/useCourseQuery"
import { useExerciseStatusSummaries } from "@/hooks/useExerciseStatusSummaries"
import DataLoadError from "@/shared-module/common/components/DataLoadError"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { courseExerciseResetToolRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { TeacherChapterLockStatus } from "@/utils/chapterLockingStatus"

const CourseExerciseStatusList: React.FC = () => {
  const { t } = useTranslation()
  const { id, user_id } = useParams<{ id: string; user_id: string }>()
  const [lockActionPendingChapterId, setLockActionPendingChapterId] = useState<string | undefined>()

  const exerciseStatusSummariesQuery = useExerciseStatusSummaries(id, user_id)
  const courseQuery = useCourseQuery(id)
  const lockStatusesQuery = useQuery(
    getCourseStudentChapterLockingStatusesOptions({
      path: {
        course_id: id,
        user_id,
      },
    }),
  )

  const updateChapterLockStatusMutation = useToastMutationOptions(
    teacherSetStudentChapterStatusMutation(),
    {
      notify: true,
      method: "POST",
    },
    {
      onMutate: (variables) => {
        setLockActionPendingChapterId(variables.path.chapter_id)
      },
      onSuccess: async () => {
        await lockStatusesQuery.refetch()
      },
      onSettled: () => {
        setLockActionPendingChapterId(undefined)
      },
    },
  )

  if (exerciseStatusSummariesQuery.isError) {
    return <ErrorBanner variant={"readOnly"} error={exerciseStatusSummariesQuery.error} />
  }

  if (exerciseStatusSummariesQuery.isLoading) {
    return <Spinner variant="medium" />
  }

  if (lockStatusesQuery.isError) {
    return <ErrorBanner variant={"readOnly"} error={lockStatusesQuery.error} />
  }

  if (lockStatusesQuery.isLoading) {
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
  const chapterLockStatuses = (lockStatusesQuery.data ?? []).reduce<
    Record<string, TeacherChapterLockStatus>
  >((acc, lockStatus) => {
    acc[lockStatus.chapter_id] = lockStatus.status
    return acc
  }, {})

  const updateChapterLockStatus = async (chapterId: string, status: TeacherChapterLockStatus) => {
    setLockActionPendingChapterId(chapterId)
    await updateChapterLockStatusMutation.mutateAsync({
      path: {
        course_id: id,
        user_id,
        chapter_id: chapterId,
      },
      body: {
        status,
      },
    })
    await lockStatusesQuery.refetch()
  }

  return (
    <>
      <h1
        className={css`
          margin-bottom: 2rem;
        `}
      >
        {t("course-status-summary")}
      </h1>
      <CourseInstanceUserInfoBox courseId={id} userId={user_id} />
      <CourseModuleCompletionsSection userId={user_id} courseId={id} />
      <CourseInstanceProgressSection userId={user_id} courseId={id} />
      {courseQuery.data?.chapter_locking_enabled === true &&
        Object.keys(chapterLockStatuses).length === 0 && (
          <p data-testid="teacher-chapter-lock-status-empty">
            {t("teacher-chapter-lock-status-empty")}
          </p>
        )}
      <ExerciseListSection
        groupedByChapter={groupedByChapter}
        courseId={id}
        onPointsUpdate={exerciseStatusSummariesQuery.refetch}
        chapterLockingEnabled={courseQuery.data?.chapter_locking_enabled === true}
        chapterLockStatusesByChapterId={chapterLockStatuses}
        onUpdateChapterLockStatus={updateChapterLockStatus}
        lockActionPendingChapterId={lockActionPendingChapterId}
      />
      <Link href={courseExerciseResetToolRoute(id, user_id)}>{t("title-reset-exercises")}</Link>
    </>
  )
}

export default withErrorBoundary(withSignedIn(CourseExerciseStatusList))
