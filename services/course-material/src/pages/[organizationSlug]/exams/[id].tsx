import { css } from "@emotion/css"
import { addMinutes, differenceInSeconds, isPast, min } from "date-fns"
import React, { useCallback, useEffect, useReducer } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import ContentRenderer from "../../../components/ContentRenderer"
import Layout from "../../../components/Layout"
import Page from "../../../components/Page"
import ExamStartBanner from "../../../components/exams/ExamStartBanner"
import ExamTimer from "../../../components/exams/ExamTimer"
import ExamTimeOverModal from "../../../components/modals/ExamTimeOverModal"
import PageContext, { CoursePageDispatch, defaultPageState } from "../../../contexts/PageContext"
import useTime from "../../../hooks/useTime"
import pageStateReducer from "../../../reducers/pageStateReducer"
import { Block, enrollInExam, fetchExam } from "../../../services/backend"
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../shared-module/contexts/LoginStateContext"
import { respondToOrLarger } from "../../../shared-module/styles/respond"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

interface ExamProps {
  // "organizationSlug"
  query: SimplifiedUrlQuery<string>
}

const Exam: React.FC<ExamProps> = ({ query }) => {
  const { t } = useTranslation()
  const examId = query.id
  const [pageState, pageStateDispatch] = useReducer(pageStateReducer, defaultPageState)
  const now = useTime(5000)

  const exam = useQuery(`exam-page-${examId}`, () => fetchExam(examId))

  useEffect(() => {
    if (exam.isError) {
      // eslint-disable-next-line i18next/no-literal-string
      pageStateDispatch({ type: "setError", payload: exam.error })
    } else if (exam.isSuccess && exam.data.enrollment_data.tag === "EnrolledAndStarted") {
      pageStateDispatch({
        // eslint-disable-next-line i18next/no-literal-string
        type: "setData",
        payload: {
          pageData: exam.data.enrollment_data.page,
          instance: null,
          settings: null,
          exam: exam.data,
        },
      })
    } else {
      // eslint-disable-next-line i18next/no-literal-string
      pageStateDispatch({ type: "setLoading" })
    }
  }, [exam.isError, exam.isSuccess, exam.data, exam.error])

  const handleRefresh = useCallback(async () => {
    await exam.refetch()
  }, [exam])

  const handleTimeOverModalClose = useCallback(async () => {
    // Maybe do something?
    await handleRefresh()
  }, [handleRefresh])

  if (exam.isIdle || exam.isLoading) {
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
            font-family: Josefin Sans, sans-serif;
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
            font-family: Lato, sans-serif;
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
                {exam.data.starts_at
                  ? t("exam-can-be-started-after", {
                      "starts-at": exam.data.starts_at.toLocaleString(),
                    })
                  : t("exam-no-start-time")}
              </div>
              <div>
                {exam.data.ends_at
                  ? t("exam-submissions-not-accepted-after", {
                      "ends-at": exam.data.ends_at.toLocaleString(),
                    })
                  : t("exam-no-end-time")}
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
        <Layout organizationSlug={query.organizationSlug}>
          {examInfo}
          <div>
            <ExamStartBanner
              onStart={async () => {
                await enrollInExam(examId)
                exam.refetch()
              }}
              examHasStarted={exam.data.starts_at ? isPast(exam.data.starts_at) : false}
              examHasEnded={exam.data.ends_at ? isPast(exam.data.ends_at) : false}
              timeMinutes={exam.data.time_minutes}
            >
              <div
                className={css`
                  opacity: 80%;
                `}
              >
                <ContentRenderer
                  data={(exam.data.instructions as Array<Block<unknown>>) ?? []}
                  editing={false}
                  selectedBlockId={null}
                  setEdits={(map) => map}
                  isExam={false}
                />
              </div>
            </ExamStartBanner>
          </div>
        </Layout>
      </>
    )
  }

  if (exam.data.enrollment_data.tag === "StudentTimeUp") {
    return (
      <>
        <Layout organizationSlug={query.organizationSlug}>
          {examInfo}
          <div>{t("exam-time-up", { "ends-at": exam.data.ends_at.toLocaleString() })}</div>
        </Layout>
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
        <Layout organizationSlug={query.organizationSlug}>
          <ExamTimeOverModal secondsLeft={secondsLeft} onClose={handleTimeOverModalClose} />
          {examInfo}

          <ExamTimer
            startedAt={exam.data.enrollment_data.enrollment.started_at}
            endsAt={endsAt}
            secondsLeft={secondsLeft}
          />
          <Page onRefresh={handleRefresh} organizationSlug={query.organizationSlug} />
        </Layout>
      </PageContext.Provider>
    </CoursePageDispatch.Provider>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(Exam)))
