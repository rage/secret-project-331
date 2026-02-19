"use client"

import { css } from "@emotion/css"
import { isPast } from "date-fns"
import { useAtomValue, useSetAtom } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import React, { useCallback, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"

import CenteredClockSkewWarning from "./CenteredClockSkewWarning"
import ExamInfoHeader from "./ExamInfoHeader"
import ExamRunningSection from "./ExamRunningSection"
import ExamStartBanner from "./ExamStartBanner"

import ContentRenderer from "@/components/course-material/ContentRenderer"
import useTime from "@/hooks/course-material/useTime"
import { Block, enrollInExam } from "@/services/course-material/backend"
import type { ExamData, ExamEnrollmentData } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
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
      <>
        <ExamInfoHeader examData={examData} />
        <CenteredClockSkewWarning />
        <div id="exam-instructions">
          <ExamStartBanner
            onStart={async () => {
              await enrollInExam(examId, mode === "testexam")
              await handleRefresh()
            }}
            examEnrollmentData={bannerEnrollmentData}
            examHasStarted={examHasStarted}
            examHasEnded={examHasEnded}
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

  if (enrollmentTag === "StudentTimeUp") {
    return (
      <>
        <CenteredClockSkewWarning />
        <ExamInfoHeader examData={examData} />
        <div>
          {t("exam-time-up", {
            "ends-at": humanReadableDateTime(examData.ends_at, i18n.language),
          })}
        </div>
      </>
    )
  }

  if (enrollmentTag === "StudentCanViewGrading" && renderGradingView) {
    return (
      <>
        <CenteredClockSkewWarning />
        <ExamInfoHeader examData={examData} />
        {renderGradingView(examData)}
      </>
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
