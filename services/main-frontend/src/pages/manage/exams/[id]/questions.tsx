import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  fetchExam,
  fetchExerciseSubmissionsAndUserExerciseStatesWithExamId,
  fetchExercisesWithExamId,
  releaseGrades,
} from "../../../../services/backend/exams"

import { ExerciseSlideSubmissionAndUserExerciseState } from "@/shared-module/common/bindings"
import Breadcrumbs, { BreadcrumbPiece } from "@/shared-module/common/components/Breadcrumbs"
import Button from "@/shared-module/common/components/Button"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import InfoComponent from "@/shared-module/common/components/InfoComponent"
import Spinner from "@/shared-module/common/components/Spinner"
import { PageMarginOffset } from "@/shared-module/common/components/layout/PageMarginOffset"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, fontWeights, headingFont } from "@/shared-module/common/styles"
import { MARGIN_BETWEEN_NAVBAR_AND_CONTENT } from "@/shared-module/common/utils/constants"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}

const GradingPage: React.FC<React.PropsWithChildren<SubmissionPageProps>> = ({ query }) => {
  const { t } = useTranslation()

  const getExam = useQuery({
    queryKey: [`/exams/${query.id}/`, query.id],
    queryFn: () => fetchExam(query.id),
  })

  const getExercises = useQuery({
    queryKey: [`/exams/${query.id}/exam-exercises`, query.id],
    queryFn: () => fetchExercisesWithExamId(query.id),
  })

  const sorted = getExercises.data?.sort((a, b) =>
    a.order_number > b.order_number ? 1 : b.order_number > a.order_number ? -1 : 0,
  )

  const getAllSubmissions = useQuery({
    queryKey: [`/exams/${query.id}/submissions-with-exam-id`, query.id],
    queryFn: () => fetchExerciseSubmissionsAndUserExerciseStatesWithExamId(query.id),
    staleTime: 1,
  })

  const allSubmissionsList = getAllSubmissions.data?.reduce(
    (acc, submissionlist) => ({
      ...acc,
      [submissionlist.at(0)?.exercise.id ?? ""]: submissionlist,
    }),
    {} as Record<string, ExerciseSlideSubmissionAndUserExerciseState[]>,
  )

  const handlePublishGradingResults = () => {
    getAllSubmissions.refetch()
    generateSubs()
    publishMutation.mutate({ id: query.id, submissions: generateSubs() })
  }

  const publishMutation = useToastMutation(
    ({
      id,
      submissions,
    }: {
      id: string
      submissions: ExerciseSlideSubmissionAndUserExerciseState[]
    }) => releaseGrades(id, submissions),
    { notify: true, method: "PUT" },
    {
      onSuccess: () => {
        getAllSubmissions.refetch(), checkPublishable()
      },
    },
  )

  const generateSubs = () => {
    const submissionList: ExerciseSlideSubmissionAndUserExerciseState[] = []
    getAllSubmissions.data?.map((exerciseSubmissionList) => {
      exerciseSubmissionList.map((submission) => {
        submissionList.push(submission)
      })
    })
    return submissionList
  }

  const checkPublishable = () => {
    let unpublishedCount = 0
    getAllSubmissions.data?.map((s) =>
      s.map((sub) => {
        if (sub.teacher_grading_decision?.hidden === true) {
          unpublishedCount = unpublishedCount + 1
        }
      }),
    )
    return unpublishedCount
  }

  const gradedCheck = (id: string) => {
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
  }

  const totalAnswered = (id: string) => {
    const submissions = allSubmissionsList?.[id]
    if (submissions) {
      return submissions.length
    } else {
      return "0"
    }
  }

  const totalGraded = (id: string) => {
    const submissions = allSubmissionsList?.[id]
    if (submissions) {
      return submissions.filter((sub) => sub.teacher_grading_decision).length
    } else {
      return "0"
    }
  }

  const totalPublished = (id: string) => {
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
  }

  const pieces: BreadcrumbPiece[] = useMemo(() => {
    const pieces = [
      // eslint-disable-next-line i18next/no-literal-string
      { text: t("link-manage"), url: `/manage/exams/${query.id}` },
      // eslint-disable-next-line i18next/no-literal-string
      { text: t("questions"), url: `/manage/exams/${query.id}/questions` },
    ]
    return pieces
  }, [query.id, t])

  return (
    <div>
      <BreakFromCentered sidebar={false}>
        <PageMarginOffset
          marginTop={`-${MARGIN_BETWEEN_NAVBAR_AND_CONTENT}`}
          // eslint-disable-next-line i18next/no-literal-string
          marginBottom={"0rem"}
        >
          <Breadcrumbs pieces={pieces} />
        </PageMarginOffset>
      </BreakFromCentered>
      {getExercises.isError && <ErrorBanner variant={"readOnly"} error={getExercises.error} />}
      {getExercises.isPending && <Spinner variant={"medium"} />}
      {getExercises.isSuccess && (
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
                    <Button
                      variant={"primary"}
                      size={"small"}
                      transform="none"
                      onClick={() => {
                        // eslint-disable-next-line i18next/no-literal-string
                        location.href = `/manage/exercises/${exercise.id}/exam-submissions/`
                      }}
                    >
                      {t("grade")}
                    </Button>
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

          <div
            className={css`
              margin-top: 1.5rem;
              display: flex;
              align-items: center;
            `}
          >
            <Button
              variant={"primary"}
              size={"small"}
              onClick={() => {
                const confirmation = confirm(
                  t("message-do-you-want-to-publish-all-currently-graded-submissions"),
                )
                if (confirmation) {
                  handlePublishGradingResults()
                }
              }}
            >
              {t("publish-grading-results")}
            </Button>
            <InfoComponent text={t("publish-grading-results-info")} />
          </div>
        </>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(GradingPage)))
