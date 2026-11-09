"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import type React from "react"
import { Trans, useTranslation } from "react-i18next"

import type { CourseModuleEndingQuestionWithAnswer } from "@/generated/api/types.generated"
import Accordion from "@/shared-module/common/components/Accordion"
import { baseTheme } from "@/shared-module/common/styles"

const Section = styled.section`
  margin: 2rem 0;
`
const AnswersCard = styled.div`
  background: ${baseTheme.colors.clear[100]};
  border: 1px solid ${baseTheme.colors.clear[200]};
  border-radius: 0.5rem;
  margin-top: 1.5rem;
  padding: 1.5rem;
  --box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.05);
`
const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
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
    <div
      className={css`
        margin-top: 1.5rem;
        border-top: 1px solid ${baseTheme.colors.clear[200]};
      `}
    >
      <AnswersCard>
        <Accordion>
          <details>
            <summary>
              <Label>{t("module-end-question-answers", { moduleName })}</Label>
            </summary>
            {endAnswers.map((a) => (
              <Section key={a.question_id}>
                <InfoItem
                  className={css`
                    background: white;
                  `}
                >
                  <Label> {t("question-n", { n: a.question_serial_number })}</Label>
                  <div
                    className={css`
                      margin-top: 0.25rem;
                      margin-bottom: 0.25rem;
                      border-top: 1px solid ${baseTheme.colors.clear[200]};
                    `}
                  ></div>
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
              </Section>
            ))}
          </details>
        </Accordion>
      </AnswersCard>
    </div>
  )
}

export default EndQuestionAnswerChip
