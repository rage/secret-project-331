import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuizItemCheckbox } from "../../../../../types/quizTypes"
import CheckBox from "../../../../shared-module/components/InputFields/CheckBox"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import EditorCard from "../common/EditorCard"

interface CheckboxEditorProps {
  quizItem: PrivateSpecQuizItemCheckbox
}

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
const OptionNameContainer = styled.div`
  width: 300vh;
  display: inline;
  position: relative;
  top: -10px;
`

const CheckboxEditor: React.FC<CheckboxEditorProps> = ({ quizItem }) => {
  const { t } = useTranslation()

  return (
    <EditorCard title={t("quiz-checkbox-name")}>
      <OptionCreationWrapper>
        <OptionCheckBoxContainer>
          <CheckBox label={""} />
        </OptionCheckBoxContainer>
        <OptionNameContainer>
          <TextField
            value={quizItem.title}
            label={t("option-title")}
            placeholder={t("option-title")}
          />
        </OptionNameContainer>
      </OptionCreationWrapper>
    </EditorCard>
  )
}

export default CheckboxEditor
