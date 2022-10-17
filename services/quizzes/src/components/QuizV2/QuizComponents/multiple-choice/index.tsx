/* eslint-disable i18next/no-literal-string */
/* Temporary fix */
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuizItemMultiplechoice } from "../../../../../types/quizTypes"
import Accordion from "../../../../shared-module/components/Accordion"
import Button from "../../../../shared-module/components/Button"
import CheckBox from "../../../../shared-module/components/InputFields/CheckBox"
import RadioButton from "../../../../shared-module/components/InputFields/RadioButton"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import { primaryFont } from "../../../../shared-module/styles"
import EditorCard from "../common/EditorCard"
import ToggleCard from "../common/ToggleCard"

import MultipleChoiceOption from "./MultipleChoiceOption"

interface MultipleChoiceEditorProps {
  quizItem: PrivateSpecQuizItemMultiplechoice
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

const MultipleChoiceEditor: React.FC<MultipleChoiceEditorProps> = ({ quizItem }) => {
  const { t } = useTranslation()

  return (
    <EditorCard title={"MULTIPLE-CHOICE"}>
      <TextField value={quizItem.title} label={t("title")} name={t("title")} />
      <OptionTitle> {t("title-options")} </OptionTitle>
      <OptionDescription>Add multiple options to this question</OptionDescription>
      <OptionCardContainer>
        {quizItem.options.map((option) => (
          <MultipleChoiceOption key={option.id} option={option} />
        ))}
      </OptionCardContainer>

      {/* New multiple choice option input */}
      <OptionCreationContainer>
        <OptionCreationWrapper>
          <OptionNameContainer>
            <TextField label={t("option-title")} placeholder={t("option-title")} />
          </OptionNameContainer>
          <OptionCheckBoxContainer>
            <CheckBox label={t("label-correct")} />
          </OptionCheckBoxContainer>
        </OptionCreationWrapper>

        <TextField label={t("success-message")} placeholder={t("success-message")} />
        <Button variant="primary" size={"medium"}>
          {t("add-option")}
        </Button>
      </OptionCreationContainer>

      {/* Advanced options */}
      <br />
      <Accordion variant="detail" title="Advanced options">
        <details>
          <summary> {t("advanced-options")} </summary>
          <AdvancedOptionsContainer>
            <OptionTitle> {t("layout-options")} </OptionTitle>
            <OptionDescription>{t("layout-options-description")}</OptionDescription>
            <MultipleChoiceLayoutChoiceContainer role="radiogroup">
              <RadioButton checked={quizItem.direction == "row"} label={t("row")} />
              <RadioButton checked={quizItem.direction == "column"} label={t("column")} />
            </MultipleChoiceLayoutChoiceContainer>
            <OptionTitle> Answering options </OptionTitle>
            <ToggleCard
              title={t("allow-selecting-multiple-options")}
              description={"All answers correct (no matter what one answers is correct)"}
              state={quizItem.allowSelectingMultipleOptions}
            />
            <ToggleCard
              title={t("shuffled-checkbox-message")}
              description={"Present choices in random order"}
              state={quizItem.shuffleOptions}
            />
            <OptionTitle> {t("feedback-message")} </OptionTitle>
            <TextField label={t("success-message")} />
            <TextField label={t("failure-message")} />
          </AdvancedOptionsContainer>
        </details>
      </Accordion>
    </EditorCard>
  )
}

export default MultipleChoiceEditor
