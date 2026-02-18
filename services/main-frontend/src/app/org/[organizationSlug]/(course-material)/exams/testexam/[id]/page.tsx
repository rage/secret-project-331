"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import { addMinutes, differenceInSeconds, min, parseISO } from "date-fns"
import { useAtomValue, useSetAtom } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { useParams } from "next/navigation"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer from "@/components/course-material/ContentRenderer"
import Page from "@/components/course-material/Page"
import ExamClockSkewWarning from "@/components/course-material/exams/ExamClockSkewWarning"
import ExamStartBanner from "@/components/course-material/exams/ExamStartBanner"
import ExamTimer from "@/components/course-material/exams/ExamTimer"
import ExamTimeOverModal from "@/components/course-material/modals/ExamTimeOverModal"
import useTime from "@/hooks/course-material/useTime"
import {
  Block,
  enrollInExam,
  resetExamProgress,
  updateShowExerciseAnswers,
} from "@/services/course-material/backend"
import Button from "@/shared-module/common/components/Button"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import Spinner from "@/shared-module/common/components/Spinner"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, fontWeights, headingFont, primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { humanReadableDateTime } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { courseMaterialAtom } from "@/state/course-material"
import { viewParamsAtom } from "@/state/course-material/params"
import { refetchViewAtom } from "@/state/course-material/selectors"
import { organizationSlugAtom } from "@/state/layoutAtoms"

const Exam: React.FC = () => {
  const params = useParams<{ organizationSlug: string; id: string }>()
  const { t, i18n } = useTranslation()
  const examId = params.id
  const [showExamAnswers, setShowExamAnswers] = useState<boolean>(false)
  const now = useTime(5000)

  const queryClient = useQueryClient()

  // Stable object reference for view params
  const viewParams = useMemo(
    () => ({
      type: "exam" as const,
      examId: examId,
      isTestMode: true,
    }),
    [examId],
  )

  // Initialize atoms synchronously on first render
  useHydrateAtoms(
    useMemo(
      () =>
        [
          [organizationSlugAtom, params.organizationSlug],
          [viewParamsAtom, viewParams],
        ] as const,
      [params.organizationSlug, viewParams],
    ),
  )

  // Read unified state
  const courseMaterialState = useAtomValue(courseMaterialAtom)

  // Handle language change
  useEffect(() => {
    if (!courseMaterialState.examData) {
      return
    }
    if (i18n.language !== courseMaterialState.examData.language) {
      i18n.changeLanguage(courseMaterialState.examData.language)
    }
  }, [courseMaterialState.examData, i18n])

  // Update showExamAnswers when exam data loads
  useEffect(() => {
    if (
      courseMaterialState.examData &&
      courseMaterialState.examData.enrollment_data.tag === "EnrolledAndStarted"
    ) {
      setShowExamAnswers(
        courseMaterialState.examData.enrollment_data.enrollment.show_exercise_answers ?? false,
      )
    }
  }, [courseMaterialState.examData])

  const showAnswersMutation = useToastMutation(
    (showAnswers: boolean) => updateShowExerciseAnswers(examId, showAnswers),
    {
      notify: false,
    },
    {
      onSuccess: async () => {
        await queryClient.refetchQueries()
      },
    },
  )

  const resetExamMutation = useToastMutation(
    () => resetExamProgress(examId),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: async () => {
        showAnswersMutation.mutate(false)
        await queryClient.refetchQueries()
      },
    },
  )

  // Handle refresh
  const triggerRefetch = useSetAtom(refetchViewAtom)
  const handleRefresh = useCallback(async () => {
    await triggerRefetch()
  }, [triggerRefetch])

  const handleTimeOverModalClose = useCallback(async () => {
    await handleRefresh()
  }, [handleRefresh])

  const handleResetProgress = useCallback(async () => {
    resetExamMutation.mutate()
  }, [resetExamMutation])

  const handleShowAnswers = useCallback(async () => {
    setShowExamAnswers(!showExamAnswers)
    showAnswersMutation.mutate(!showExamAnswers)
  }, [showAnswersMutation, showExamAnswers])

  // Error handling
  if (courseMaterialState.error) {
    return <ErrorBanner variant={"readOnly"} error={courseMaterialState.error} />
  }

  // Loading state
  if (courseMaterialState.status === "loading" || !courseMaterialState.examData) {
    return <Spinner variant="medium" />
  }

  const examData = courseMaterialState.examData

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
            font-family:
              Josefin Sans,
              sans-serif;
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
          {examData.name}
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
          {(examData.enrollment_data.tag === "NotEnrolled" ||
            examData.enrollment_data.tag === "NotYetStarted") && (
            <>
              <div>
                <HideTextInSystemTests
                  text={
                    examData.starts_at
                      ? t("exam-can-be-started-after", {
                          "starts-at": humanReadableDateTime(examData.starts_at, i18n.language),
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
                    examData.ends_at
                      ? t("exam-submissions-not-accepted-after", {
                          "ends-at": humanReadableDateTime(examData.ends_at, i18n.language),
                        })
                      : t("exam-no-end-time")
                  }
                  testPlaceholder={t("exam-submissions-not-accepted-after", {
                    "ends-at": "1/1/1970, 7:00:00 PM",
                  })}
                />
              </div>
              <div> {t("exam-time-to-complete", { "time-minutes": examData.time_minutes })}</div>
            </>
          )}
        </div>
      </div>
    </BreakFromCentered>
  )
  const clockSkewWarning = <ExamClockSkewWarning />

  if (
    examData.enrollment_data.tag === "NotEnrolled" ||
    examData.enrollment_data.tag === "NotYetStarted"
  ) {
    if (examData.enrollment_data.tag === "NotEnrolled") {
      examData.enrollment_data.can_enroll = true
    }
    return (
      <>
        {clockSkewWarning}
        {examInfo}
        <div id="exam-instructions">
          <ExamStartBanner
            onStart={async () => {
              await enrollInExam(examId, true)
              await handleRefresh()
            }}
            examEnrollmentData={examData.enrollment_data}
            examHasStarted={true}
            examHasEnded={false}
            timeMinutes={examData.time_minutes}
          >
            <div
              id="maincontent"
              className={css`
                opacity: 80%;
              `}
            >
              <ContentRenderer
                data={(examData.instructions as Array<Block<unknown>>) ?? []}
                isExam={false}
                dontAllowBlockToBeWiderThanContainerWidth={false}
              />
            </div>
          </ExamStartBanner>
        </div>
      </>
    )
  }

  if (examData.enrollment_data.tag === "StudentTimeUp") {
    return (
      <>
        {clockSkewWarning}
        {examInfo}
        <div>
          {t("exam-time-up", {
            "ends-at": humanReadableDateTime(examData.ends_at, i18n.language),
          })}
        </div>
      </>
    )
  }

  // Only render page if enrolled and started
  if (examData.enrollment_data.tag !== "EnrolledAndStarted") {
    return <Spinner variant="medium" />
  }

  const endsAt = examData.ends_at
    ? min([
        addMinutes(examData.enrollment_data.enrollment.started_at, examData.time_minutes),
        examData.ends_at,
      ])
    : addMinutes(examData.enrollment_data.enrollment.started_at, examData.time_minutes)
  const secondsLeft = differenceInSeconds(endsAt, now)
  const warningMessageClass = css`
    background: linear-gradient(
      140deg,
      ${baseTheme.colors.yellow[100]},
      ${baseTheme.colors.clear[100]}
    );
    border: 1px solid ${baseTheme.colors.yellow[300]};
    border-left: 8px solid ${baseTheme.colors.yellow[600]};
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin: 1rem 0;
  `
  const messageTextClass = css`
    margin: 0;
    font-family: ${primaryFont};
    font-size: clamp(0.95rem, 2.2vw, 1rem);
    line-height: 1.45;
    color: ${baseTheme.colors.gray[700]};
  `

  return (
    <>
      {clockSkewWarning}
      <ExamTimeOverModal
        disabled={examData.ended}
        secondsLeft={secondsLeft}
        onClose={handleTimeOverModalClose}
      />
      {examInfo}
      <ExamTimer
        startedAt={parseISO(examData.enrollment_data.enrollment.started_at)}
        endsAt={endsAt}
        secondsLeft={secondsLeft}
      />
      {secondsLeft < 10 * 60 && secondsLeft >= 0 && (
        <div className={warningMessageClass}>
          <p className={messageTextClass}>{t("exam-time-running-out-soon-help-text")}</p>
        </div>
      )}
      <Page onRefresh={handleRefresh} organizationSlug={params.organizationSlug} />
      <>
        {examData?.enrollment_data.enrollment.is_teacher_testing && (
          <div
            className={css`
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              gap: 20px;

              ${respondToOrLarger.sm} {
                flex-direction: row;
                align-items: baseline;
              }

              span {
                font-size: 20px;
                font-family: ${headingFont};
                font-weight: ${fontWeights.semibold};
                color: ${baseTheme.colors.gray[700]};
              }
            `}
          >
            <Button
              className={css`
                font-size: 20px !important;
                font-family: ${headingFont} !important;
              `}
              variant="primary"
              size="medium"
              transform="capitalize"
              onClick={() => {
                handleResetProgress()
              }}
            >
              {t("button-text-reset-exam-progress")}
            </Button>
            <CheckBox
              label={t("show-answers")}
              checked={showExamAnswers}
              onChange={() => {
                handleShowAnswers()
              }}
            />
          </div>
        )}
      </>
    </>
  )
}

export default withErrorBoundary(withSignedIn(Exam))
