"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import type React from "react"
import { Trans, useTranslation } from "react-i18next"

import type { CourseModuleEndingQuestionWithAnswer } from "@/generated/api/types.generated"
import Accordion from "@/shared-module/common/components/Accordion"
import DebugModal from "@/shared-module/common/components/DebugModal"
import { baseTheme } from "@/shared-module/common/styles"

const Divider = styled.hr`
  margin: 0 1rem;
  padding: 0;
  height: 0;
  border: 1px solid ${baseTheme.colors.clear[300]};
`

const AnswersCard = styled.div`
  display: grid;
`

const InfoItem = styled.div`
  display: flex;
  margin: 0.75rem;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  * {
    margin-left: 0;
  }
  background: ${baseTheme.colors.clear[100]};
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.clear[200]};
`

const Label = styled.span`
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.875rem;
  font-weight: 500;
`

const Value = styled.span`
  color: ${baseTheme.colors.gray[700]};
  font-size: 1.125rem;
  font-weight: 600;
`

const EndQuestionAnswerChip: React.FC<{
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

        <AnswersCard>
          {endAnswers.map((a) => (
            <InfoItem
              key={a.question_id}
              className={css`
                background: white;
              `}
            >
              <Label> {t("question-n", { n: a.question_serial_number })}</Label>
              <Divider />
              <Label>
                <Trans t={t} i18nKey="question-x" values={{ x: a.question_text }} />
              </Label>
              {a.answer_select_value && (
                <>
                  <Label>{t("label-selected-value")}</Label>
                  <Value>{a.answer_select_value}</Value>
                </>
              )}
              {a.answer_multi_select_value?.length !== 0 && (
                <>
                  <Label>{t("label-selected-values")}</Label>
                  <Value>{a.answer_multi_select_value?.join(", ")}</Value>
                </>
              )}
              {a.question_free_text_instruction && (
                <Label>
                  <Trans
                    t={t}
                    i18nKey="instructions-x"
                    values={{ x: a.question_free_text_instruction }}
                  />
                </Label>
              )}
              {a.answer_text_value && (
                <>
                  <Label>{t("student-answer")}</Label>
                  <Value>{a.answer_text_value}</Value>
                </>
              )}
            </InfoItem>
          ))}
        </AnswersCard>
      </details>
    </Accordion>
  )
}

export default EndQuestionAnswerChip
