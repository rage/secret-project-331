"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import AnswersRequiringAttentionList from "../submissions/AnswersRequiringAttentionList"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import useExerciseQuery from "@/hooks/useExeciseQuery"
import { fetchAnswersRequiringAttention } from "@/services/backend/answers-requiring-attention"
import { AccordionProvider } from "@/shared-module/common/components/Accordion/accordionContext"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Pagination from "@/shared-module/common/components/Pagination"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const ExerciseTitle = ({ children }: { children: React.ReactNode }) => (
  <h5
    className={css`
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 2.5rem;
      margin-top: 0.5rem;
      color: ${baseTheme.colors.gray[500]};
      font-family: ${primaryFont};
      text-align: center;
    `}
  >
    {children}
  </h5>
)

const SubmissionsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const exerciseQuery = useExerciseQuery(id)
  const paginationInfo = usePaginationInfo()
  const courseStructure = useCourseStructure(exerciseQuery.data?.course_id ?? null)

  const crumbs = useMemo(
    () => [{ isLoading: false as const, label: t("header-answers-requiring-attention") }],
    [t],
  )

  useRegisterBreadcrumbs({
    key: `exercise:${id}:answers-requiring-attention`,
    order: 60,
    crumbs,
  })

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
      `exercises-${id}-answers-requiring-attention`,
      paginationInfo.page,
      paginationInfo.limit,
    ],
    queryFn: () => fetchAnswersRequiringAttention(id, paginationInfo.page, paginationInfo.limit),
  })

  if (courseStructure.isLoading) {
    return <Spinner variant="medium" />
  }

  if (courseStructure.isError) {
    return <ErrorBanner variant="readOnly" error={courseStructure.error} />
  }

  return (
    <div>
      <h4
        className={css`
          color: ${baseTheme.colors.gray[700]};
          font-family: ${primaryFont};
          font-size: 28px;
          font-weight: 600;
          line-height: 1.2;
          letter-spacing: -0.01em;
          text-align: center;
          margin-bottom: 0.75rem;
          margin-top: 1rem;
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

      {answersQuery.isLoading && <Spinner variant="medium" />}

      {answersQuery.isSuccess && (
        // AccordionProvider here allows us to collapse/expand all accordions in this subtree
        <AccordionProvider>
          <AnswersRequiringAttentionList
            answersRequiringAttention={answersQuery.data.data}
            exercise_max_points={answersQuery.data.exercise_max_points}
            courseId={exerciseQuery.data?.course_id ?? null}
            refetch={answersQuery.refetch}
          />
          <Pagination totalPages={answersQuery.data?.total_pages} paginationInfo={paginationInfo} />
        </AccordionProvider>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(SubmissionsPage))
