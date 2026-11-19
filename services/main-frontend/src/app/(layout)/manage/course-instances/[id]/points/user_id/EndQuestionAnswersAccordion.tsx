"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import type React from "react"
import { useTranslation } from "react-i18next"

import type { CourseModuleEndingQuestionWithAnswer } from "@/generated/api/types.generated"
import Accordion from "@/shared-module/common/components/Accordion"
import DebugModal from "@/shared-module/common/components/DebugModal"
import { baseTheme } from "@/shared-module/common/styles"

import EndQuestionAnswerCard from "./EndQuestionAnswerCard"

const Divider = styled.hr`
  margin: 0 1rem;
  padding: 0;
  height: 0;
  border: 1px solid ${baseTheme.colors.clear[300]};
`

const Label = styled.span`
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.875rem;
  font-weight: 500;
`

const EndQuestionAnswersAccordion: React.FC<{
  endAnswers: CourseModuleEndingQuestionWithAnswer[]
  moduleName: string
}> = ({ endAnswers, moduleName }) => {
  const { t } = useTranslation()
  return (
    <Accordion
      className={css`
        background: ${baseTheme.colors.clear[100]};
        border-radius: 0.5rem;
        margin-top: 1.5rem;
        details,
        details > summary {
          display: flex;
          flex-flow: row nowrap;
          justify-content: space-between;
          border-radius: 0.5rem;
        }
        details[open] > div {
          padding: 0;
        }
      `}
    >
      <details>
        <summary>
          <Label>{t("module-end-question-answers", { moduleName })}</Label>
          <DebugModal data={endAnswers} variant="minimal" />
        </summary>
        <Divider />
        <EndQuestionAnswerCard endAnswers={endAnswers} />
      </details>
    </Accordion>
  )
}

export default EndQuestionAnswersAccordion
