import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { addMinutes, differenceInSeconds, isPast, min, parseISO } from "date-fns"
import React, { useCallback, useContext, useEffect, useReducer } from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer from "../../../components/ContentRenderer"
import Page from "../../../components/Page"
import ExamStartBanner from "../../../components/exams/ExamStartBanner"
import ExamTimer from "../../../components/exams/ExamTimer"
import ExamTimeOverModal from "../../../components/modals/ExamTimeOverModal"
import LayoutContext from "../../../contexts/LayoutContext"
import PageContext, { CoursePageDispatch, getDefaultPageState } from "../../../contexts/PageContext"
import useTime from "../../../hooks/useTime"
import pageStateReducer from "../../../reducers/pageStateReducer"

import { Block, endExamTime, enrollInExam, fetchExam } from "@/services/backend"
import Button from "@/shared-module/common/components/Button"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, headingFont, primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import { humanReadableDateTime } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface ExamProps {
  // "organizationSlug"
  query: SimplifiedUrlQuery<string>
}

const Exam: React.FC<React.PropsWithChildren<ExamProps>> = ({ query }) => {
  const { t, i18n } = useTranslation()
  const examId = query.id
  const [pageState, pageStateDispatch] = useReducer(
    pageStateReducer,
    // We don't pass a refetch function here on purpose because refetching during an exam is risky because we don't want to accidentally lose unsubmitted answers
    getDefaultPageState(undefined),
  )
  const now = useTime(5000)

  const exam = useQuery({ queryKey: [`exam-page-${examId}`], queryFn: () => fetchExam(examId) })
  const { refetch: refetchExam } = exam

  useEffect(() => {
    if (exam.isError) {
      pageStateDispatch({ type: "setError", payload: exam.error })
    } else if (exam.isSuccess && exam.data.enrollment_data.tag === "EnrolledAndStarted") {
      pageStateDispatch({
        type: "setData",
        payload: {
          pageData: exam.data.enrollment_data.page,
          instance: null,
          settings: null,
          exam: exam.data,
          isTest: false,
        },
      })
    } else {
      pageStateDispatch({ type: "setLoading" })
    }
  }, [exam.isError, exam.isSuccess, exam.data, exam.error])

  useEffect(() => {
    if (!exam.data) {
      return
    }
    if (i18n.language !== exam.data.language) {
      i18n.changeLanguage(exam.data.language)
    }
  })

  const layoutContext = useContext(LayoutContext)
  useEffect(() => {
    layoutContext.setOrganizationSlug(query.organizationSlug)
  }, [layoutContext, query.organizationSlug])

  const handleRefresh = useCallback(async () => {
    await refetchExam()
  }, [refetchExam])

  const handleTimeOverModalClose = useCallback(async () => {
    await handleRefresh()
  }, [handleRefresh])

  const handleEndExam = () => {
    endExamMutation.mutate({ id: examId })
  }

  const endExamMutation = useToastMutation(
    ({ id }: { id: string }) => endExamTime(id),
    { notify: true, method: "POST" },
    {
      onSuccess: async () => {
        await handleRefresh()
      },
    },
  )

  if (exam.isPending) {
    return <Spinner variant="medium" />
  }

  if (exam.isError) {
    return <ErrorBanner variant={"readOnly"} error={exam.error} />
  }

  const examInfo = (
    <BreakFromCentered sidebar={false}>
      <div
        className={css`
          background: #f6f6f6;

          padding: 20px;
          margin-bottom: 49px;

          ${respondToOrLarger.sm} {
            padding-top: 81px;
            padding-left: 128px;
            padding-right: 128px;
            padding-bottom: 83px;
          }
        `}
      >
        <div
          className={css`
            font-family: ${primaryFont};
            font-size: 30px;
            font-style: normal;
            font-weight: 600;
            line-height: 30px;
            letter-spacing: 0em;
            text-align: left;
            color: #333333;

            text-transform: uppercase;
          `}
        >
          {exam.data.name}
        </div>
        <div
          className={css`
            font-family: ${primaryFont};
            font-size: 20px;
            font-style: normal;
            font-weight: 500;
            line-height: 26px;
            letter-spacing: 0em;
            text-align: left;
            color: #353535;
          `}
        >
          {(exam.data.enrollment_data.tag === "NotEnrolled" ||
            exam.data.enrollment_data.tag === "NotYetStarted") && (
            <>
              <div>
                <HideTextInSystemTests
                  text={
                    exam.data.starts_at
                      ? t("exam-can-be-started-after", {
                          "starts-at": exam.data.starts_at.toLocaleString(),
                        })
                      : t("exam-no-start-time")
                  }
                  testPlaceholder={t("exam-can-be-started-after", {
                    "starts-at": "1/1/1970, 0:00:00 AM",
                  })}
                />
              </div>
              <div>
                <HideTextInSystemTests
                  text={
                    exam.data.ends_at
                      ? t("exam-submissions-not-accepted-after", {
                          "ends-at": exam.data.ends_at.toLocaleString(),
                        })
                      : t("exam-no-end-time")
                  }
                  testPlaceholder={t("exam-submissions-not-accepted-after", {
                    "ends-at": "1/1/1970, 7:00:00 PM",
                  })}
                />
              </div>
              <div> {t("exam-time-to-complete", { "time-minutes": exam.data.time_minutes })}</div>
            </>
          )}
        </div>
      </div>
    </BreakFromCentered>
  )

  if (
    exam.data.enrollment_data.tag === "NotEnrolled" ||
    exam.data.enrollment_data.tag === "NotYetStarted"
  ) {
    return (
      <>
        {examInfo}
        <div id="exam-instructions">
          <ExamStartBanner
            onStart={async () => {
              await enrollInExam(examId, false)
              exam.refetch()
            }}
            examEnrollmentData={exam.data.enrollment_data}
            examHasStarted={exam.data.starts_at ? isPast(exam.data.starts_at) : false}
            examHasEnded={exam.data.ends_at ? isPast(exam.data.ends_at) : false}
            timeMinutes={exam.data.time_minutes}
          >
            <div
              id="maincontent"
              className={css`
                opacity: 80%;
              `}
            >
              <ContentRenderer
                data={(exam.data.instructions as Array<Block<unknown>>) ?? []}
                isExam={false}
                dontAllowBlockToBeWiderThanContainerWidth={false}
              />
            </div>
          </ExamStartBanner>
        </div>
      </>
    )
  }

  if (exam.data.enrollment_data.tag === "StudentTimeUp") {
    return (
      <>
        {examInfo}
        <div>{t("exam-time-up", { "ends-at": humanReadableDateTime(exam.data.ends_at) })}</div>
      </>
    )
  }

  if (exam.data.enrollment_data.tag === "StudentCanViewGrading") {
    return (
      <>
        {examInfo}
        {exam.data.enrollment_data.gradings.map(
          (grade) =>
            !grade[0].hidden && (
              <div
                key={grade[0].id}
                className={css`
                  display: flex;
                  flex-direction: column;
                  background: #f5f6f7;
                  font-family: ${headingFont};
                  font-size: 18px;
                  padding: 8px;
                  margin: 10px;
                `}
              >
                <div>
                  {t("label-name")}: {grade[1].name}
                </div>
                <div>
                  {t("points")}: {grade[0].score_given} / {grade[1].score_maximum}
                </div>
                <div
                  className={css`
                    color: #535a66;
                    font-size: 16px;
                    padding-top: 1rem;
                  `}
                >
                  {t("label-feedback")}:
                  <div
                    className={css`
                      background: #ffffff;
                      color: #535a66;
                      padding: 10px;
                    `}
                  >
                    {grade[0].justification}
                  </div>
                </div>
              </div>
            ),
        )}
      </>
    )
  }

  const endsAt = exam.data.ends_at
    ? min([
        addMinutes(exam.data.enrollment_data.enrollment.started_at, exam.data.time_minutes),
        exam.data.ends_at,
      ])
    : addMinutes(exam.data.enrollment_data.enrollment.started_at, exam.data.time_minutes)
  const secondsLeft = differenceInSeconds(endsAt, now)

  return (
    <CoursePageDispatch.Provider value={pageStateDispatch}>
      <PageContext.Provider value={pageState}>
        <ExamTimeOverModal
          disabled={exam.data.ended}
          secondsLeft={secondsLeft}
          onClose={handleTimeOverModalClose}
        />
        {examInfo}

        <ExamTimer
          startedAt={parseISO(exam.data.enrollment_data.enrollment.started_at)}
          endsAt={endsAt}
          secondsLeft={secondsLeft}
        />
        {secondsLeft < 10 * 60 && secondsLeft >= 0 && (
          <div
            className={css`
              background-color: ${baseTheme.colors.yellow[100]};
              color: black;
              padding: 0.7rem 1rem;
              margin: 1rem 0;
              border: 1px solid ${baseTheme.colors.yellow[300]};
            `}
          >
            <div>{t("exam-time-running-out-soon-help-text")}</div>
          </div>
        )}
        {exam.data.ended && (
          <div
            className={css`
              background-color: ${baseTheme.colors.yellow[100]};
              color: black;
              padding: 0.7rem 1rem;
              margin: 1rem 0;
              border: 1px solid ${baseTheme.colors.yellow[300]};
            `}
          >
            <div>{t("exam-ended-see-points-below")}</div>
          </div>
        )}
        <Page onRefresh={handleRefresh} organizationSlug={query.organizationSlug} />
        {!exam.data.ended && (
          <Button
            variant={"primary"}
            size={"small"}
            onClick={() => {
              const confirmation = confirm(t("message-do-you-want-to-end-the-exam"))
              if (confirmation) {
                handleEndExam()
              }
            }}
          >
            {t("button-end-exam")}
          </Button>
        )}
      </PageContext.Provider>
    </CoursePageDispatch.Provider>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(Exam)))
