"use client"

import { css } from "@emotion/css"
import { isPast } from "date-fns"
import { useAtomValue, useSetAtom } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import React, { useCallback, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"

import CenteredClockSkewWarning from "./CenteredClockSkewWarning"
import ExamClockSkewWarning from "./ExamClockSkewWarning"
import ExamInfoHeader from "./ExamInfoHeader"
import ExamRunningSection from "./ExamRunningSection"
import ExamStartBanner from "./ExamStartBanner"

import ContentRenderer from "@/components/course-material/ContentRenderer"
import useTime from "@/hooks/course-material/useTime"
import { Block, enrollInExam } from "@/services/course-material/backend"
import type { ExamData, ExamEnrollmentData } from "@/shared-module/common/bindings"
import Centered from "@/shared-module/common/components/Centering/Centered"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { humanReadableDateTime } from "@/shared-module/common/utils/time"
import { courseMaterialAtom } from "@/state/course-material"
import { viewParamsAtom } from "@/state/course-material/params"
import { refetchViewAtom } from "@/state/course-material/selectors"
import { organizationSlugAtom } from "@/state/layoutAtoms"

export type ExamPageShellMode = "exam" | "testexam"

export interface ExamPageShellProps {
  mode: ExamPageShellMode
  examId: string
  organizationSlug: string
  renderFooterActions?: (ctx: {
    examId: string
    examData: ExamData
    onRefresh: () => Promise<void>
  }) => React.ReactNode
  renderAfterPage?: (ctx: { examId: string; examData: ExamData }) => React.ReactNode
  renderGradingView?: (examData: ExamData) => React.ReactNode
  showEndedInfo?: boolean
}

/** Shared exam page container: atoms, language, loading/error, and branch-specific UI. */
export default function ExamPageShell({
  mode,
  examId,
  organizationSlug,
  renderFooterActions,
  renderAfterPage,
  renderGradingView,
  showEndedInfo = false,
}: ExamPageShellProps) {
  const { t, i18n } = useTranslation()
  const now = useTime(5000)

  const viewParams = useMemo(
    () => ({
      type: "exam" as const,
      examId,
      isTestMode: mode === "testexam",
    }),
    [examId, mode],
  )

  useHydrateAtoms(
    useMemo(
      () =>
        [
          [organizationSlugAtom, organizationSlug],
          [viewParamsAtom, viewParams],
        ] as const,
      [organizationSlug, viewParams],
    ),
  )

  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const triggerRefetch = useSetAtom(refetchViewAtom)
  const handleRefresh = useCallback(async () => {
    await triggerRefetch()
  }, [triggerRefetch])

  const enrollMutation = useToastMutation(
    () => enrollInExam(examId, mode === "testexam"),
    { notify: true, method: "POST" },
    { onSuccess: handleRefresh },
  )

  useEffect(() => {
    if (!courseMaterialState.examData) {
      return
    }
    if (i18n.language !== courseMaterialState.examData.language) {
      i18n.changeLanguage(courseMaterialState.examData.language)
    }
  }, [courseMaterialState.examData, i18n])

  const examEnrollmentDataForBanner = useMemo((): ExamEnrollmentData | null => {
    const data = courseMaterialState.examData
    if (!data) {
      return null
    }
    if (mode === "testexam" && data.enrollment_data.tag === "NotEnrolled") {
      return { ...data.enrollment_data, can_enroll: true }
    }
    return data.enrollment_data
  }, [mode, courseMaterialState.examData])

  if (courseMaterialState.error) {
    return <ErrorBanner variant="readOnly" error={courseMaterialState.error} />
  }
  if (courseMaterialState.status === "loading" || !courseMaterialState.examData) {
    return <Spinner variant="medium" />
  }

  const examData = courseMaterialState.examData
  const enrollmentTag = examData.enrollment_data.tag
  const bannerEnrollmentData: ExamEnrollmentData =
    examEnrollmentDataForBanner ?? examData.enrollment_data

  const examHasStarted =
    mode === "testexam" ? true : examData.starts_at ? isPast(examData.starts_at) : false
  const examHasEnded =
    mode === "testexam" ? false : examData.ends_at ? isPast(examData.ends_at) : false

  if (enrollmentTag === "NotEnrolled" || enrollmentTag === "NotYetStarted") {
    return (
      <Centered variant="default">
        <div
          className={css`
            padding-top: 2rem;
          `}
        />
        <ExamInfoHeader examData={examData} />
        <ExamClockSkewWarning />
        <div id="exam-instructions">
          <ExamStartBanner
            onStart={async () => {
              await enrollMutation.mutateAsync()
            }}
            examEnrollmentData={bannerEnrollmentData}
            examHasStarted={examHasStarted}
            examHasEnded={examHasEnded}
            timeMinutes={examData.time_minutes}
          >
            <div id="maincontent">
              <ContentRenderer
                data={(examData.instructions as Array<Block<unknown>>) ?? []}
                isExam={false}
                dontAllowBlockToBeWiderThanContainerWidth={false}
              />
            </div>
          </ExamStartBanner>
        </div>
      </Centered>
    )
  }

  if (enrollmentTag === "StudentTimeUp") {
    const timeUpMessageClass = css`
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
      font-family: ${primaryFont};
      font-size: clamp(0.95rem, 2.2vw, 1rem);
      line-height: 1.45;
      color: ${baseTheme.colors.gray[700]};
    `
    return (
      <Centered variant="default">
        <div
          className={css`
            padding-top: 2rem;
          `}
        />
        <ExamClockSkewWarning />
        <ExamInfoHeader examData={examData} />
        <div className={timeUpMessageClass}>
          {t("exam-time-up", {
            "ends-at": humanReadableDateTime(examData.ends_at, i18n.language),
          })}
        </div>
      </Centered>
    )
  }

  if (enrollmentTag === "StudentCanViewGrading") {
    if (renderGradingView) {
      return (
        <Centered variant="default">
          <div
            className={css`
              padding-top: 2rem;
            `}
          />
          <ExamClockSkewWarning />
          <ExamInfoHeader examData={examData} />
          {renderGradingView(examData)}
        </Centered>
      )
    }
    if (typeof console !== "undefined" && console.warn) {
      console.warn("ExamPageShell: renderGradingView not provided for StudentCanViewGrading")
    }
    return (
      <Centered variant="default">
        <div
          className={css`
            padding-top: 2rem;
          `}
        />
        <CenteredClockSkewWarning />
        <ExamInfoHeader examData={examData} />
      </Centered>
    )
  }

  if (enrollmentTag !== "EnrolledAndStarted") {
    return <Spinner variant="medium" />
  }

  return (
    <ExamRunningSection
      examData={examData}
      now={now}
      onRefresh={handleRefresh}
      organizationSlug={organizationSlug}
      renderFooterActions={() =>
        renderFooterActions?.({ examId, examData, onRefresh: handleRefresh })
      }
      renderAfterPage={() => renderAfterPage?.({ examId, examData })}
      showEndedInfo={showEndedInfo}
    />
  )
}
