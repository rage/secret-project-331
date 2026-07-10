"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { groupBy } from "lodash"
import Link from "next/link"
import { useParams } from "next/navigation"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import AnswersInManualReviewSection from "@/app/manage/course-instances/[id]/points/user_id/AnswersInManualReviewSection"
import CourseInstanceProgressSection from "@/app/manage/course-instances/[id]/points/user_id/CourseInstanceProgressSection"
import CourseInstanceUserInfoBox from "@/app/manage/course-instances/[id]/points/user_id/CourseInstanceUserInfoBox"
import CourseModuleCompletionsSection from "@/app/manage/course-instances/[id]/points/user_id/CourseModuleCompletionsSection"
import ExerciseListSection from "@/app/manage/course-instances/[id]/points/user_id/ExerciseListSection"
import CourseActivityTimeline from "@/components/CourseActivityTimeline"
import { renderReadOnlyBlockingError } from "@/components/queryResultErrorRenderers"
import {
  getCourseStudentChapterLockingStatusesOptions,
  teacherSetStudentChapterStatusMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import { useCourseQuery } from "@/hooks/useCourseQuery"
import { useExerciseStatusSummaries } from "@/hooks/useExerciseStatusSummaries"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { courseExerciseResetToolRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResults } from "@/shared-module/components"
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
    <QueryResults
      queries={[exerciseStatusSummariesQuery, lockStatusesQuery] as const}
      treatEmptyAsData
      renderBlockingError={renderReadOnlyBlockingError}
      renderData={([exerciseStatusSummaries, lockStatuses]) => {
        const groupedByChapter = Object.entries(
          groupBy(exerciseStatusSummaries, (exerciseStatus) => exerciseStatus.exercise.chapter_id),
        )
        const chapterLockStatuses = lockStatuses.reduce<Record<string, TeacherChapterLockStatus>>(
          (acc, lockStatus) => {
            acc[lockStatus.chapter_id] = lockStatus.status
            return acc
          },
          {},
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
            <CourseInstanceUserInfoBox courseId={id} userId={user_id} />
            <h2
              className={css`
                margin: 1.5rem 0 0.75rem;
              `}
            >
              {t("user-activity")}
            </h2>
            <CourseActivityTimeline courseId={id} userId={user_id} />
            <AnswersInManualReviewSection exerciseStatusSummaries={exerciseStatusSummaries} />
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
            <Link href={courseExerciseResetToolRoute(id, user_id)}>
              {t("title-reset-exercises")}
            </Link>
          </>
        )
      }}
    />
  )
}

export default withErrorBoundary(withSignedIn(CourseExerciseStatusList))
