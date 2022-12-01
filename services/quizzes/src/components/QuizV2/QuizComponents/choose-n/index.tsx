import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuizItemChooseN } from "../../../../../types/quizTypes"
import Accordion from "../../../../shared-module/components/Accordion"
import Button from "../../../../shared-module/components/Button"
import CheckBox from "../../../../shared-module/components/InputFields/CheckBox"
import { primaryFont } from "../../../../shared-module/styles"
import EditorCard from "../common/EditorCard"
// import ParsedTextField from "../common/ParsedTextField"

import MultipleChoiceOption from "./MultipleChoiceOption"

interface ChooseNEditorProps {
  quizItem: PrivateSpecQuizItemChooseN
}

const OptionTitle = styled.div`
  font-size: 20px;
  font-family: ${primaryFont};
  font-weight: bold;
`

const OptionDescription = styled.div`
  font-size: 17px;
  color: #b3b3b3;
  margin-bottom: 12px;
`

const OptionCardContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const OptionNameContainer = styled.div`
  width: 80vh;
  display: inline;
  position: relative;
  top: -10px;
`
const OptionCheckBoxContainer = styled.div`
  width: 15vh;
  display: inline;
  margin-left: 20px;
  padding: 0px 8px;
`

const OptionCreationWrapper = styled.div`
  /* Remove margin from input */
  * {
    margin: 0px;
  }
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 8px;
  height: 45px;
  margin-top: 16px;
`

const OptionCreationContainer = styled.div`
  background-color: #fbfbfb;
  border: 1px solid #e2e4e6;
  width: 100%;
  margin-top: 28px;
  padding: 20px;
`

const AdvancedOptionsContainer = styled.div`
  padding: 8px;
`

const ChooseNEditor: React.FC<ChooseNEditorProps> = ({ quizItem }) => {
  const { t } = useTranslation()

  return (
    <EditorCard title={t("quiz-clickable-multiple-choice-name")}>
      {/* <ParsedTextField label={t("title")} /> */}
      <OptionTitle> {t("title-options")} </OptionTitle>
      <OptionDescription>{t("title-options-description")}</OptionDescription>
      <OptionCardContainer>
        {quizItem.options.map((option) => (
          <MultipleChoiceOption key={option.id} option={option} />
        ))}
      </OptionCardContainer>

      {/* New multiple choice option input */}
      <OptionCreationContainer>
        <OptionCreationWrapper>
          <OptionNameContainer>
            {/* <ParsedTextField label={t("option-title")} /> */}
          </OptionNameContainer>
          <OptionCheckBoxContainer>
            <CheckBox label={t("label-correct")} />
          </OptionCheckBoxContainer>
        </OptionCreationWrapper>

        {/* <ParsedTextField label={t("success-message")} /> */}
        <Button variant="primary" size={"medium"}>
          {t("add-option")}
        </Button>
      </OptionCreationContainer>

      {/* Advanced options */}
      <br />
      <Accordion variant="detail" title={t("advanced-options")}>
        <details>
          <summary> {t("advanced-options")} </summary>
          <AdvancedOptionsContainer>
            <OptionTitle> {t("feedback-message")} </OptionTitle>
            {/* <ParsedTextField label={t("success-message")} /> */}
            {/* <ParsedTextField label={t("failure-message")} /> */}
          </AdvancedOptionsContainer>
        </details>
      </Accordion>
    </EditorCard>
  )
}

export default ChooseNEditor
