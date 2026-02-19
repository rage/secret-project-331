"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import type { ExamData } from "@/shared-module/common/bindings"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { humanReadableDateTime } from "@/shared-module/common/utils/time"

export interface ExamInfoHeaderProps {
  examData: ExamData
}

/** Gray info box with exam name and (when not started) start/end times and duration. */
export default function ExamInfoHeader({ examData }: ExamInfoHeaderProps) {
  const { t, i18n } = useTranslation()
  const showTimes =
    examData.enrollment_data.tag === "NotEnrolled" ||
    examData.enrollment_data.tag === "NotYetStarted"

  return (
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
          {showTimes && (
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
}
