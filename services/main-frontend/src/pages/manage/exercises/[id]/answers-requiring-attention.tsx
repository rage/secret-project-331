import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import AnswersRequiringAttentionList from "../../../../components/page-specific/manage/exercises/id/submissions/AnswersRequiringAttentionList"
import { fetchAnswersRequiringAttention } from "../../../../services/backend/answers-requiring-attention"

import MainFrontendBreadCrumbs from "@/components/MainFrontendBreadCrumbs"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import useExerciseQuery from "@/hooks/useExeciseQuery"
import { AccordionProvider } from "@/shared-module/common/components/Accordion/accordionContext"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Pagination from "@/shared-module/common/components/Pagination"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import { manageCourseExercisesRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}

const ExerciseTitle = ({ children }: { children: React.ReactNode }) => (
  <h5
    className={css`
      font-size: 20px;
      font-weight: 500;
      margin-bottom: 2rem;
      margin-top: -0.5rem;
      color: ${baseTheme.colors.gray[600]};
      font-family: ${primaryFont};
      text-align: center;
    `}
  >
    {children}
  </h5>
)

const SubmissionsPage: React.FC<SubmissionPageProps> = ({ query }) => {
  const { t } = useTranslation()
  const exerciseQuery = useExerciseQuery(query.id)
  const paginationInfo = usePaginationInfo()
  const courseStructure = useCourseStructure(exerciseQuery.data?.course_id ?? null)
  const courseBreadcrumbInfo = useCourseBreadcrumbInfoQuery(exerciseQuery.data?.course_id ?? null)

  const exerciseContext = useMemo(() => {
    if (!courseStructure.data || !exerciseQuery.data) {
      return null
    }

    const pageId = exerciseQuery.data.page_id
    const chapterId = exerciseQuery.data.chapter_id

    return {
      exercisePage: courseStructure.data.pages.find((page) => page.id === pageId),
      exercise: exerciseQuery.data,
      chapter: courseStructure.data.chapters.find((chapter) => chapter.id === chapterId),
    }
  }, [courseStructure.data, exerciseQuery.data])

  const answersQuery = useQuery({
    queryKey: [
      `exercises-${query.id}-answers-requiring-attention`,
      paginationInfo.page,
      paginationInfo.limit,
    ],
    queryFn: () =>
      fetchAnswersRequiringAttention(query.id, paginationInfo.page, paginationInfo.limit),
  })

  if (courseStructure.isPending) {
    return <Spinner variant="medium" />
  }

  if (courseStructure.isError) {
    return <ErrorBanner variant="readOnly" error={courseStructure.error} />
  }

  return (
    <div>
      <MainFrontendBreadCrumbs
        organizationSlug={courseBreadcrumbInfo.data?.organization_slug ?? null}
        courseId={exerciseContext?.exercise.course_id ?? null}
        exerciseName={exerciseContext?.exercise.name}
        exerciseUrl={manageCourseExercisesRoute(exerciseContext?.exercise.course_id ?? "")}
        additionalPieces={[{ text: t("header-answers-requiring-attention"), url: "" }]}
      />

      <h4
        className={css`
          color: #313947;
          font-family: ${primaryFont};
          font-size: 30px;
          font-weight: 500;
          line-height: 30px;
          letter-spacing: 0em;
          text-align: center;
          opacity: 0.8;
          margin-bottom: 1em;
        `}
      >
        {t("header-answers-requiring-attention")}
      </h4>

      {exerciseContext && (
        <ExerciseTitle>
          {exerciseContext.exercise.name}{" "}
          <span
            className={css`
              font-size: 16px;
            `}
          >
            ({exerciseContext.chapter?.name} / {exerciseContext.exercisePage?.title})
          </span>
        </ExerciseTitle>
      )}

      {answersQuery.isError && <ErrorBanner variant="readOnly" error={answersQuery.error} />}

      {answersQuery.isPending && <Spinner variant="medium" />}

      {answersQuery.isSuccess && (
        // AccordionProvider here allows us to collapse/expand all accordions in this subtree
        <AccordionProvider>
          <AnswersRequiringAttentionList
            answersRequiringAttention={answersQuery.data.data}
            exercise_max_points={answersQuery.data.exercise_max_points}
            refetch={answersQuery.refetch}
          />
          <Pagination totalPages={answersQuery.data?.total_pages} paginationInfo={paginationInfo} />
        </AccordionProvider>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(SubmissionsPage)))
