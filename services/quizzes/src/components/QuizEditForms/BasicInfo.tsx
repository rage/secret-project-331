import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import Accordion from "../../shared-module/components/Accordion"
import RadioButton from "../../shared-module/components/InputFields/RadioButton"
import { baseTheme, primaryFont } from "../../shared-module/styles"
import {
  editedQuizzesDirection,
  editedQuizzesSubmitmessage,
} from "../../store/editor/quiz/quizActions"
import { useTypedSelector } from "../../store/store"
import { COLUMN, ROW } from "../../util/constants"
import MarkdownEditor from "../MarkdownEditor"

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

const BasicInformation: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const quizId = useTypedSelector((state) => state.editor.quizId)

  const submitMessage = useTypedSelector((state) => state.editor.quizzes[quizId].submitMessage)
  const direction = useTypedSelector((state) => state.editor.quizzes[quizId].direction) ?? COLUMN

  return (
    <InfoContainer>
      <MarkdownEditor
        text={submitMessage ?? ""}
        label={t("submit-message")}
        onChange={(value) => dispatch(editedQuizzesSubmitmessage(quizId, value))}
      />
      <Accordion variant="detail" title={t("advanced-options")}>
        <details>
          <summary>{t("advanced-options")}</summary>
          <AdvancedOptionsContainer>
            <OptionTitle> {t("layout-options")} </OptionTitle>
            <OptionDescription>
              {t("quiz-item-display-direction")}{" "}
              {t("this-feature-is-only-meant-for-closed-end-questions")}
            </OptionDescription>
            <MultipleChoiceLayoutChoiceContainer role="radiogroup">
              <RadioButton
                checked={direction === ROW}
                onClick={() => dispatch(editedQuizzesDirection(ROW, quizId))}
                label={t("row")} // horizontal
              />
              <RadioButton
                checked={direction === COLUMN}
                onClick={() => dispatch(editedQuizzesDirection(COLUMN, quizId))}
                label={t("column")} // vertical
              />
            </MultipleChoiceLayoutChoiceContainer>
          </AdvancedOptionsContainer>
        </details>
      </Accordion>
    </InfoContainer>
  )
}

export default BasicInformation
