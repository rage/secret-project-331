import { css } from "@emotion/css"
import { addMinutes, differenceInSeconds, isPast } from "date-fns"
import React, { useCallback, useEffect, useReducer } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../../components/Layout"
import Page from "../../../components/Page"
import ExamStartBanner from "../../../components/exams/ExamStartBanner"
import ExamTimer from "../../../components/exams/ExamTimer"
import ExamTimeOverModal from "../../../components/modals/ExamTimeOverModal"
import CoursePageContext, {
  CoursePageDispatch,
  defaultCoursePageState,
} from "../../../contexts/CoursePageContext"
import useTime from "../../../hooks/useTime"
import coursePageStateReducer from "../../../reducers/coursePageStateReducer"
import { enrollInExam, fetchExam } from "../../../services/backend"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
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
  const [pageState, pageStateDispatch] = useReducer(coursePageStateReducer, defaultCoursePageState)
  const now = useTime(5000)

  const exam = useQuery(`exam-page-${examId}`, () => fetchExam(examId))

  useEffect(() => {
    if (exam.isError) {
      // eslint-disable-next-line i18next/no-literal-string
      pageStateDispatch({ type: "setError", payload: exam.error })
    } else if (exam.isSuccess && exam.data.tag === "EnrolledAndStarted") {
      pageStateDispatch({
        // eslint-disable-next-line i18next/no-literal-string
        type: "setData",
        payload: {
          pageData: exam.data.page,
          instance: null,
          settings: null,
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

  if (exam.data.tag === "NotEnrolled") {
    return (
      <>
        <Layout organizationSlug={query.organizationSlug}>
          <div className={normalWidthCenteredComponentStyles}>
            <ExamStartBanner
              onStart={async () => {
                await enrollInExam(examId)
                exam.refetch()
              }}
              examHasStarted={exam.data.starts_at ? isPast(exam.data.starts_at) : false}
            />
          </div>
        </Layout>
      </>
    )
  }

  if (exam.data.tag === "NotYetStarted") {
    return (
      <>
        <Layout organizationSlug={query.organizationSlug}>
          <div className={normalWidthCenteredComponentStyles}>
            <div>{t("exam-has-not-started-yet")}</div>
          </div>
        </Layout>
      </>
    )
  }

  const examHasNotEnded = false
  return (
    <CoursePageDispatch.Provider value={pageStateDispatch}>
      <CoursePageContext.Provider value={pageState}>
        <Layout organizationSlug={query.organizationSlug}>
          {
            <>
              {examHasNotEnded && (
                <ExamTimeOverModal
                  secondsLeft={differenceInSeconds(
                    addMinutes(exam.data.enrollment.started_at, exam.data.time_minutes),
                    now,
                  )}
                  onClose={handleTimeOverModalClose}
                />
              )}
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
                  {t("instructions")}:{" "}
                  <span
                    className={css`
                      opacity: 60%;
                    `}
                  >
                    {exam.data.instructions}
                  </span>
                </div>
              </div>

              <ExamTimer
                startedAt={exam.data.enrollment.started_at}
                endsAt={addMinutes(exam.data.enrollment.started_at, exam.data.time_minutes)}
                secondsLeft={differenceInSeconds(
                  addMinutes(exam.data.enrollment.started_at, exam.data.time_minutes),
                  now,
                )}
                maxScore={100}
              />
            </>
          }
          <Page onRefresh={handleRefresh} organizationSlug={query.organizationSlug} />
        </Layout>
      </CoursePageContext.Provider>
    </CoursePageDispatch.Provider>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(Exam))
