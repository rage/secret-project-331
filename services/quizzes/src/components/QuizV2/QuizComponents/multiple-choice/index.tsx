import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuizItemMultiplechoice } from "../../../../../types/quizTypes"
import Accordion from "../../../../shared-module/components/Accordion"
import Button from "../../../../shared-module/components/Button"
import CheckBox from "../../../../shared-module/components/InputFields/CheckBox"
import RadioButton from "../../../../shared-module/components/InputFields/RadioButton"
import SelectField from "../../../../shared-module/components/InputFields/SelectField"
import { primaryFont } from "../../../../shared-module/styles"
import EditorCard from "../common/EditorCard"
import ParsedTextField from "../common/ParsedTextField"
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

  const MULTIPLE_CHOICE_OPTIONS = [
    {
      value: "default",
      label: t("multiple-choice-grading-default"),
    },
    {
      value: "points-off-incorrect-options",
      label: t("multiple-choice-grading-points-off-incorrect-options"),
    },
    {
      value: "points-off-unselected-options",
      label: t("multiple-choice-grading-points-off-unselected-options"),
    },
  ]

  return (
    <EditorCard title={t("quiz-multiple-choice-name")}>
      <ParsedTextField label={t("title")} />
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
            <ParsedTextField label={t("option-title")} />
          </OptionNameContainer>
          <OptionCheckBoxContainer>
            <CheckBox label={t("label-correct")} />
          </OptionCheckBoxContainer>
        </OptionCreationWrapper>

        <ParsedTextField label={t("success-message")} />
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
            <OptionTitle> {t("layout-options")} </OptionTitle>
            <OptionDescription>{t("layout-options-description")}</OptionDescription>
            <MultipleChoiceLayoutChoiceContainer role="radiogroup">
              <RadioButton checked={quizItem.direction == "row"} label={t("row")} />
              <RadioButton checked={quizItem.direction == "column"} label={t("column")} />
            </MultipleChoiceLayoutChoiceContainer>
            <OptionTitle> {t("answer-settings")}</OptionTitle>
            <ToggleCard
              title={t("shuffled-checkbox-message")}
              description={t("shuffle-option-description")}
              state={quizItem.shuffleOptions}
            />
            <ToggleCard
              title={t("allow-selecting-multiple-options")}
              description={t("allow-selecting-multiple-options-description")}
              state={quizItem.allowSelectingMultipleOptions}
            />
            <SelectField
              id={"multiple-choice-grading"}
              className={css`
                width: 100%;
                margin-bottom: 0.3rem;
              `}
              disabled={!quizItem.allowSelectingMultipleOptions}
              onChange={(value) =>
                // TODO: handle cache
                console.log(value)
              }
              defaultValue={quizItem.multipleChoiceMultipleOptionsGradingPolicy}
              label={t("multiple-choice-grading")}
              options={MULTIPLE_CHOICE_OPTIONS}
            />
            <span
              className={css`
                color: #414246;
                font-size: 14px;
                font-family: Josefin Sans, sans-serif;
                display: block;
                margin-bottom: 8px;
                ${!quizItem.allowSelectingMultipleOptions && "opacity: 0.5;"}
              `}
            >
              {quizItem.multipleChoiceMultipleOptionsGradingPolicy == "default" &&
                t("multiple-choice-grading-default-description")}
              {quizItem.multipleChoiceMultipleOptionsGradingPolicy ==
                "points-off-incorrect-options" &&
                t("multiple-choice-grading-points-off-incorrect-options-description")}
              {quizItem.multipleChoiceMultipleOptionsGradingPolicy ==
                "points-off-unselected-options" &&
                t("multiple-choice-grading-points-off-unselected-options-description")}
            </span>
            <OptionTitle> {t("feedback-message")} </OptionTitle>
            <ParsedTextField label={t("success-message")} />
            <ParsedTextField label={t("failure-message")} />
          </AdvancedOptionsContainer>
        </details>
      </Accordion>
    </EditorCard>
  )
}

export default MultipleChoiceEditor
