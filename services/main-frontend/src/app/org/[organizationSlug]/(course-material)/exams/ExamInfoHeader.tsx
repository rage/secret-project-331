"use client"

import { css } from "@emotion/css"
import { Trans, useTranslation } from "react-i18next"

import type { ExamData } from "@/shared-module/common/bindings"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { baseTheme, headingFont, primaryFont, typography } from "@/shared-module/common/styles"
import { humanReadableDateTime } from "@/shared-module/common/utils/time"

export interface ExamInfoHeaderProps {
  examData: ExamData
}

const dateValueClass = css`
  font-weight: 600;
`

/** Exam name and (when not started) start/end times and duration. */
export default function ExamInfoHeader({ examData }: ExamInfoHeaderProps) {
  const { t, i18n } = useTranslation()
  const showTimes =
    examData.enrollment_data.tag === "NotEnrolled" ||
    examData.enrollment_data.tag === "NotYetStarted"

  return (
    <div
      className={css`
        padding-bottom: 1rem;
        margin-bottom: 1rem;
        border-bottom: 1px solid ${baseTheme.colors.clear[300]};
      `}
    >
      <h1
        className={css`
          font-family: ${headingFont};
          font-size: ${typography.h4};
          font-weight: 700;
          line-height: 1.2;
          color: ${baseTheme.colors.gray[700]};
          margin: 0;
        `}
      >
        {examData.name}
      </h1>
      {showTimes && (
        <div
          className={css`
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
            margin-top: 1rem;
            font-family: ${primaryFont};
            font-size: 0.9375rem;
            line-height: 1.5;
            color: ${baseTheme.colors.gray[600]};
          `}
        >
          <div>
            {examData.starts_at ? (
              <HideTextInSystemTests
                text={
                  <Trans
                    i18nKey="exam-can-be-started-after"
                    values={{
                      "starts-at": humanReadableDateTime(examData.starts_at, i18n.language),
                    }}
                    components={{ 1: <span className={dateValueClass} /> }}
                  />
                }
                testPlaceholder={
                  <Trans
                    i18nKey="exam-can-be-started-after"
                    values={{ "starts-at": "1/1/1970, 0:00:00 AM" }}
                    components={{ 1: <span className={dateValueClass} /> }}
                  />
                }
              />
            ) : (
              t("exam-no-start-time")
            )}
          </div>
          <div>
            {examData.ends_at ? (
              <HideTextInSystemTests
                text={
                  <Trans
                    i18nKey="exam-submissions-not-accepted-after"
                    values={{
                      "ends-at": humanReadableDateTime(examData.ends_at, i18n.language),
                    }}
                    components={{ 1: <span className={dateValueClass} /> }}
                  />
                }
                testPlaceholder={
                  <Trans
                    i18nKey="exam-submissions-not-accepted-after"
                    values={{ "ends-at": "1/1/1970, 7:00:00 PM" }}
                    components={{ 1: <span className={dateValueClass} /> }}
                  />
                }
              />
            ) : (
              t("exam-no-end-time")
            )}
          </div>
          <div
            className={css`
              color: ${baseTheme.colors.green[700]};
              font-weight: 600;
            `}
          >
            {t("exam-time-to-complete", { "time-minutes": examData.time_minutes })}
          </div>
        </div>
      )}
    </div>
  )
}
