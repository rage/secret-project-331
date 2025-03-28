import { css } from "@emotion/css"
import { groupBy } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import CourseInstanceProgressSection from "../../../../../components/page-specific/manage/course-instances/id/points/user_id/CourseInstanceProgressSection"
import CourseInstanceUserInfoBox from "../../../../../components/page-specific/manage/course-instances/id/points/user_id/CourseInstanceUserInfoBox"
import CourseModuleCompletionsSection from "../../../../../components/page-specific/manage/course-instances/id/points/user_id/CourseModuleCompletionsSection"
import ExerciseListSection from "../../../../../components/page-specific/manage/course-instances/id/points/user_id/ExerciseListSection"
import { useCourseIdFromExerciseStatus } from "../../../../../hooks/useCourseIdFromExerciseStatus"
import { useExerciseStatusSummaries } from "../../../../../hooks/useExerciseStatusSummaries"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface CourseInstancePointsListProps {
  query: SimplifiedUrlQuery<string>
}

const CourseInstanceExerciseStatusList: React.FC<
  React.PropsWithChildren<CourseInstancePointsListProps>
> = ({ query }) => {
  const { t } = useTranslation()

  const exerciseStatusSummariesQuery = useExerciseStatusSummaries(query.id, query.user_id)
  const courseId = useCourseIdFromExerciseStatus(exerciseStatusSummariesQuery.data)

  if (exerciseStatusSummariesQuery.isError) {
    return <ErrorBanner variant={"readOnly"} error={exerciseStatusSummariesQuery.error} />
  }

  if (exerciseStatusSummariesQuery.isPending || !exerciseStatusSummariesQuery.data || !courseId) {
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
      <CourseInstanceUserInfoBox
        courseId={courseId}
        courseInstanceId={query.id}
        userId={query.user_id}
      />
      <CourseModuleCompletionsSection
        courseInstanceId={query.id}
        userId={query.user_id}
        courseId={courseId}
      />
      <CourseInstanceProgressSection
        courseInstanceId={query.id}
        userId={query.user_id}
        courseId={courseId}
      />
      <ExerciseListSection groupedByChapter={groupedByChapter} courseId={courseId} />
    </>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CourseInstanceExerciseStatusList)),
)
