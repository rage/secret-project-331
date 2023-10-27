import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuiz } from "../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../hooks/useQuizzesExerciseServiceOutputState"
import Accordion from "../../../shared-module/components/Accordion"
import RadioButton from "../../../shared-module/components/InputFields/RadioButton"
import { baseTheme, primaryFont } from "../../../shared-module/styles"
import MarkdownEditor from "../../MarkdownEditor"

const AdvancedOptionsContainer = styled.div`
  padding: 8px;
`

const InfoContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 1rem 0;
  row-gap: 1rem;
`

const MultipleChoiceLayoutChoiceContainer = styled.div`
  display: flex;
  flex-direction: row;
  /* Remove margin from the RadioButtons*/
  * {
    margin: 0px;
  }
  padding: 2px;
  gap: 16px;
  margin-bottom: 16px;
`

const OptionDescription = styled.div`
  font-size: 17px;
  color: ${baseTheme.colors.gray[500]};
  margin-bottom: 12px;
`

const OptionTitle = styled.div`
  font-size: 20px;
  font-family: ${primaryFont};
  font-weight: bold;
`

const VERTICAL = "vertical"
const HORIZONTAL = "horizontal"

const QuizCommonInfo: React.FC = () => {
  const { t } = useTranslation()

  const { selected, updateState } = useQuizzesExerciseServiceOutputState<PrivateSpecQuiz>(
    (quiz) => quiz,
  )

  if (selected === null) {
    return <></>
  }

  return (
    <InfoContainer>
      <Accordion variant="detail" title={t("advanced-options")}>
        <details>
          <summary>{t("advanced-options")}</summary>
          <AdvancedOptionsContainer>
            <MarkdownEditor
              text={selected.submitMessage ?? ""}
              label={t("submit-message")}
              onChange={(value) => {
                updateState((draft) => {
                  if (!draft) {
                    return
                  }
                  draft.submitMessage = value
                })
              }}
            />
            <OptionTitle> {t("layout-options")} </OptionTitle>
            <OptionDescription>
              {t("quiz-item-display-direction")}{" "}
              {t("this-feature-is-only-meant-for-closed-end-questions")}
            </OptionDescription>
            <MultipleChoiceLayoutChoiceContainer role="radiogroup">
              <RadioButton
                checked={selected.quizItemDisplayDirection === HORIZONTAL}
                onClick={() => {
                  updateState((draft) => {
                    if (!draft) {
                      return
                    }
                    draft.quizItemDisplayDirection = HORIZONTAL
                  })
                }}
                label={t("horizontal")}
              />
              <RadioButton
                checked={selected.quizItemDisplayDirection === VERTICAL}
                onClick={() => {
                  updateState((draft) => {
                    if (!draft) {
                      return
                    }
                    draft.quizItemDisplayDirection = VERTICAL
                  })
                }}
                label={t("vertical")}
              />
            </MultipleChoiceLayoutChoiceContainer>
          </AdvancedOptionsContainer>
        </details>
      </Accordion>
    </InfoContainer>
  )
}

export default QuizCommonInfo
