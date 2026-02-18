"use client"

import { css } from "@emotion/css"
import { addMinutes, differenceInSeconds, isPast, min, parseISO } from "date-fns"
import { useAtomValue, useSetAtom } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { useParams } from "next/navigation"
import React, { useCallback, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer from "@/components/course-material/ContentRenderer"
import Page from "@/components/course-material/Page"
import ExamClockSkewWarning from "@/components/course-material/exams/ExamClockSkewWarning"
import ExamStartBanner from "@/components/course-material/exams/ExamStartBanner"
import ExamTimer from "@/components/course-material/exams/ExamTimer"
import ExamTimeOverModal from "@/components/course-material/modals/ExamTimeOverModal"
import useTime from "@/hooks/course-material/useTime"
import { Block, endExamTime, enrollInExam } from "@/services/course-material/backend"
import Button from "@/shared-module/common/components/Button"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, headingFont, primaryFont } from "@/shared-module/common/styles"
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
  const now = useTime(5000)
  const { confirm } = useDialog()

  // Stable object reference for view params
  const viewParams = useMemo(
    () => ({
      type: "exam" as const,
      examId: examId,
      isTestMode: false,
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

  // Handle refresh
  const triggerRefetch = useSetAtom(refetchViewAtom)
  const handleRefresh = useCallback(async () => {
    await triggerRefetch()
  }, [triggerRefetch])

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
    return (
      <>
        {clockSkewWarning}
        {examInfo}
        <div id="exam-instructions">
          <ExamStartBanner
            onStart={async () => {
              await enrollInExam(examId, false)
              await handleRefresh()
            }}
            examEnrollmentData={examData.enrollment_data}
            examHasStarted={examData.starts_at ? isPast(examData.starts_at) : false}
            examHasEnded={examData.ends_at ? isPast(examData.ends_at) : false}
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

  if (examData.enrollment_data.tag === "StudentCanViewGrading") {
    return (
      <>
        {clockSkewWarning}
        {examInfo}
        {examData.enrollment_data.gradings.map(
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
  const infoMessageClass = css`
    background: linear-gradient(
      140deg,
      ${baseTheme.colors.blue[100]},
      ${baseTheme.colors.clear[100]}
    );
    border: 1px solid ${baseTheme.colors.blue[300]};
    border-left: 8px solid ${baseTheme.colors.blue[600]};
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
      {examData.ended && (
        <div className={infoMessageClass}>
          <p className={messageTextClass}>{t("exam-ended-see-points-below")}</p>
        </div>
      )}
      <Page onRefresh={handleRefresh} organizationSlug={params.organizationSlug} />
      {!examData.ended && (
        <Button
          variant={"primary"}
          size={"small"}
          onClick={async () => {
            const confirmation = await confirm(t("message-do-you-want-to-end-the-exam"))
            if (confirmation) {
              handleEndExam()
            }
          }}
        >
          {t("button-end-exam")}
        </Button>
      )}
    </>
  )
}

export default withErrorBoundary(withSignedIn(Exam))
