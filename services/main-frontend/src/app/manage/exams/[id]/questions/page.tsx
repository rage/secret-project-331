"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import React, { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  getExamExercisesOptions,
  getExamOptions,
  getExamSubmissionsWithExamIdOptions,
  releaseExamGradesMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { ExerciseSlideSubmissionAndUserExerciseState } from "@/generated/api/types.generated"
import Breadcrumbs, { BreadcrumbPiece } from "@/shared-module/common/components/Breadcrumbs"
import Button from "@/shared-module/common/components/Button"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import InfoComponent from "@/shared-module/common/components/InfoComponent"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme, fontWeights, headingFont } from "@/shared-module/common/styles"
import { joinTitleSegments } from "@/shared-module/common/utils/pageTitle"
import { exerciseExamSubmissionsRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

const GradingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const router = useRouter()
  const { confirm } = useDialog()

  const getExam = useQuery({
    ...getExamOptions({
      path: {
        id,
      },
    }),
  })

  usePageTitle(joinTitleSegments([t("questions"), getExam.data?.name]), { order: 10 })

  const getExercises = useQuery({
    ...getExamExercisesOptions({
      path: {
        exam_id: id,
      },
    }),
  })

  const sorted = useMemo(
    () =>
      [...(getExercises.data ?? [])].sort((a, b) =>
        a.order_number > b.order_number ? 1 : b.order_number > a.order_number ? -1 : 0,
      ),
    [getExercises.data],
  )

  const getAllSubmissions = useQuery({
    ...getExamSubmissionsWithExamIdOptions({
      path: {
        exam_id: id,
      },
    }),
    staleTime: 1,
  })

  const allSubmissionsList = getAllSubmissions.data?.reduce(
    (acc, submissionlist) => ({
      ...acc,
      [submissionlist.at(0)?.exercise.id ?? ""]: submissionlist,
    }),
    {} as Record<string, ExerciseSlideSubmissionAndUserExerciseState[]>,
  )

  const publishMutation = useToastMutationOptions(
    releaseExamGradesMutation(),
    { notify: true, method: "POST" },
    {
      onSuccess: async () => {
        await getAllSubmissions.refetch()
      },
    },
  )

  const checkPublishable = useCallback(() => {
    let unpublishedCount = 0
    getAllSubmissions.data?.forEach((s) => {
      s.forEach((sub) => {
        if (sub.teacher_grading_decision?.hidden === true) {
          unpublishedCount += 1
        }
      })
    })
    return unpublishedCount
  }, [getAllSubmissions.data])

  const gradedCheck = useCallback(
    (id: string) => {
      if (!getExam.data?.grade_manually) {
        return (
          <div
            className={css`
              color: #32bea6;
            `}
          >
            {t("label-graded-automatically")}
          </div>
        )
      }

      const submissions = allSubmissionsList?.[id]
      if (submissions) {
        const countGraded = submissions.filter((sub) => sub.teacher_grading_decision).length
        if (submissions.length === countGraded) {
          return (
            <div
              className={css`
                color: #32bea6;
              `}
            >
              {t("status-graded")}
            </div>
          )
        } else if (countGraded === 0) {
          return (
            <div
              className={css`
                color: #f76d82;
              `}
            >
              {t("status-ungraded")}
            </div>
          )
        } else if (submissions.length > countGraded) {
          return (
            <div
              className={css`
                color: #ffce54;
              `}
            >
              {t("status-in-progress")}
            </div>
          )
        }
      } else {
        return " "
      }
    },
    [getExam.data, allSubmissionsList, t],
  )

  const totalAnswered = useCallback(
    (id: string) => {
      const submissions = allSubmissionsList?.[id]
      if (submissions) {
        return submissions.length
      } else {
        return "0"
      }
    },
    [allSubmissionsList],
  )

  const totalGraded = useCallback(
    (id: string) => {
      if (!getExam.data?.grade_manually) {
        return <div>{totalAnswered(id)}</div>
      }
      const submissions = allSubmissionsList?.[id]
      if (submissions) {
        return submissions.filter((sub) => sub.teacher_grading_decision).length
      } else {
        return "0"
      }
    },
    [getExam.data?.grade_manually, allSubmissionsList, totalAnswered],
  )

  const totalPublished = useCallback(
    (id: string) => {
      if (!getExam.data?.grade_manually) {
        return <div>0</div>
      }
      const submissions = allSubmissionsList?.[id]
      let count = 0
      if (submissions) {
        submissions.map((sub) => {
          if (sub.teacher_grading_decision?.hidden === true) {
            count = count + 1
          }
        })
      }
      return count
    },
    [allSubmissionsList, getExam.data?.grade_manually],
  )

  const pieces: BreadcrumbPiece[] = useMemo(() => {
    const pieces = [
      // eslint-disable-next-line i18next/no-literal-string
      { text: t("link-manage"), url: `/manage/exams/${id}` },
      // eslint-disable-next-line i18next/no-literal-string
      { text: t("questions"), url: `/manage/exams/${id}/questions` },
    ]
    return pieces
  }, [id, t])

  const questionsContent = (
    <>
      <h3
        className={css`
          font-weight: ${fontWeights.medium};
          font-family: ${headingFont};
        `}
      >
        {getExam.data?.name}
      </h3>
      <table
        className={css`
          border-collapse: collapse;
          margin-top: 1.5rem;
          width: 100%;

          td,
          th {
            padding-left: 20px;
            text-align: left;
            height: 60px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          tr {
            border-bottom: 1.5px solid #0000001a;
            font-size: ${baseTheme.fontSizes[18]};
          }
        `}
      >
        <thead>
          <tr
            className={css`
              font-family: ${headingFont};
              font-weight: ${fontWeights.semibold};
              font-size: ${baseTheme.fontSizes[18]};
              color: #7c7c7ccc;
              opacity: 0.8;
            `}
          >
            <th>{t("label-grade")}</th>
            <th>{t("question")}</th>
            <th>{t("status")}</th>
            <th>{t("number-of-answered")}</th>
            <th>{t("number-of-graded")}</th>
            <th>{t("number-of-unpublished-gradings")}</th>
            <th>{t("points")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted?.map((exercise) => (
            <tr key={exercise.name}>
              <td>
                {getExam.data?.grade_manually ? (
                  <Button
                    variant={"primary"}
                    size={"small"}
                    transform="none"
                    onClick={() => {
                      router.push(exerciseExamSubmissionsRoute(exercise.id))
                    }}
                  >
                    {t("grade")}
                  </Button>
                ) : (
                  <Button
                    variant={"primary"}
                    size={"small"}
                    transform="none"
                    onClick={() => {
                      router.push(exerciseExamSubmissionsRoute(exercise.id))
                    }}
                  >
                    {t("label-review")}
                  </Button>
                )}
              </td>
              <td>{t("question-n", { n: exercise.order_number + 1 })}</td>
              <td>{exercise.id && gradedCheck(exercise.id)}</td>
              <td>{exercise.id && totalAnswered(exercise.id)}</td>
              <td>{exercise.id && totalGraded(exercise.id)}</td>
              <td>{exercise.id && totalPublished(exercise.id)}</td>
              <td>{exercise.score_maximum}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {getExam.data?.grade_manually && (
        <div
          className={css`
            margin-top: 1.5rem;
          `}
        >
          {checkPublishable() != 0 && (
            <GenericInfobox>
              {t("unpublishable-grading-results", { amount: checkPublishable() })}
            </GenericInfobox>
          )}
        </div>
      )}
      <div
        className={css`
          margin-top: 1.5rem;
          display: flex;
          align-items: center;
        `}
      >
        <Button
          disabled={!getExam.data?.grade_manually}
          variant={"primary"}
          size={"small"}
          onClick={async () => {
            const confirmation = await confirm(
              t("message-do-you-want-to-publish-all-currently-graded-submissions"),
            )
            if (confirmation) {
              const freshSubmissions = await getAllSubmissions.refetch()
              if (!freshSubmissions.data) {
                throw new Error("Failed to fetch submissions")
              }

              const teacherGradingDecisionIds = freshSubmissions.data
                .flatMap((exerciseSubmissionList) =>
                  exerciseSubmissionList.map((sub) => sub.teacher_grading_decision?.id),
                )
                .filter(
                  (gradingDecisionId): gradingDecisionId is string =>
                    gradingDecisionId !== undefined,
                )

              publishMutation.mutate({
                path: {
                  exam_id: id,
                },
                body: teacherGradingDecisionIds,
              })
            }
          }}
        >
          {t("publish-grading-results")}
        </Button>
        <InfoComponent text={t("publish-grading-results-info")} />
      </div>
    </>
  )

  return (
    <div>
      <BreakFromCentered sidebar={false}>
        <Breadcrumbs pieces={pieces} />
      </BreakFromCentered>
      <QueryResult query={getExercises} treatEmptyAsData>
        {() => questionsContent}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(GradingPage))
