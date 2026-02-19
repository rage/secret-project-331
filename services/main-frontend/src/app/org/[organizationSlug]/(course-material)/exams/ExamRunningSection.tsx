"use client"

import { css } from "@emotion/css"
import { addMinutes, differenceInSeconds, min, parseISO } from "date-fns"
import React from "react"
import { useTranslation } from "react-i18next"

import CenteredClockSkewWarning from "./CenteredClockSkewWarning"
import ExamInfoHeader from "./ExamInfoHeader"
import ExamTimer from "./ExamTimer"

import Page from "@/components/course-material/Page"
import ExamTimeOverModal from "@/components/course-material/modals/ExamTimeOverModal"
import type { ExamData } from "@/shared-module/common/bindings"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"

export interface ExamRunningSectionProps {
  examData: ExamData
  now: Date
  onRefresh: () => Promise<void>
  organizationSlug: string
  renderFooterActions?: () => React.ReactNode
  renderAfterPage?: () => React.ReactNode
  showEndedInfo?: boolean
}

/** Enrolled-and-started view: clock skew, timer, time-over modal, running-out banner, Page, and optional footer/after slots. */
export default function ExamRunningSection({
  examData,
  now,
  onRefresh,
  organizationSlug,
  renderFooterActions,
  renderAfterPage,
  showEndedInfo = false,
}: ExamRunningSectionProps) {
  const { t } = useTranslation()

  if (examData.enrollment_data.tag !== "EnrolledAndStarted") {
    return null
  }
  const { enrollment } = examData.enrollment_data
  const startedAt = parseISO(enrollment.started_at)
  const endsAt = examData.ends_at
    ? min([addMinutes(startedAt, examData.time_minutes), parseISO(examData.ends_at)])
    : addMinutes(startedAt, examData.time_minutes)
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
      <CenteredClockSkewWarning />
      <ExamTimeOverModal disabled={examData.ended} secondsLeft={secondsLeft} onClose={onRefresh} />
      <ExamInfoHeader examData={examData} />
      <ExamTimer startedAt={startedAt} endsAt={endsAt} secondsLeft={secondsLeft} />
      {secondsLeft < 10 * 60 && secondsLeft >= 0 && (
        <div className={warningMessageClass}>
          <p className={messageTextClass}>{t("exam-time-running-out-soon-help-text")}</p>
        </div>
      )}
      {showEndedInfo && examData.ended && (
        <div className={infoMessageClass}>
          <p className={messageTextClass}>{t("exam-ended-see-points-below")}</p>
        </div>
      )}
      <Page onRefresh={onRefresh} organizationSlug={organizationSlug} />
      {renderFooterActions?.()}
      {renderAfterPage?.()}
    </>
  )
}
