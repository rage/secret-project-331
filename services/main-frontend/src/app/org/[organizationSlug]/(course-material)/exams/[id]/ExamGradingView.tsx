"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import type { ExamData } from "@/shared-module/common/bindings"
import { headingFont } from "@/shared-module/common/styles"

export interface ExamGradingViewProps {
  examData: ExamData
}

/** Renders grading list when enrollment_data is StudentCanViewGrading. */
export default function ExamGradingView({ examData }: ExamGradingViewProps) {
  const { t } = useTranslation()
  if (examData.enrollment_data.tag !== "StudentCanViewGrading") {
    return null
  }
  const { gradings } = examData.enrollment_data
  return (
    <>
      {gradings.map(
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
