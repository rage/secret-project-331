import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuizItemCheckbox } from "../../../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../../../hooks/useQuizzesExerciseServiceOutputState"
import findQuizItem from "../../utils/general"
import EditorCard from "../common/EditorCard"

import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import TextField from "@/shared-module/common/components/InputFields/TextField"

interface CheckboxEditorProps {
  quizItemId: string
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

const CheckboxEditor: React.FC<CheckboxEditorProps> = ({ quizItemId }) => {
  const { t } = useTranslation()

  const { selected, updateState } =
    useQuizzesExerciseServiceOutputState<PrivateSpecQuizItemCheckbox>((quiz) => {
      // eslint-disable-next-line i18next/no-literal-string
      return findQuizItem<PrivateSpecQuizItemCheckbox>(quiz, quizItemId, "checkbox")
    })

  if (selected === null) {
    return <></>
  }

  return (
    <EditorCard quizItemId={quizItemId} title={t("quiz-checkbox-name")}>
      <OptionCreationWrapper>
        <OptionCheckBoxContainer>
          <CheckBox label="" />
        </OptionCheckBoxContainer>
        <OptionNameContainer>
          <TextField
            value={selected.title ?? undefined}
            label={t("option-title")}
            placeholder={t("option-title")}
            onChangeByValue={(value) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                draft.title = value
              })
            }}
          />
        </OptionNameContainer>
      </OptionCreationWrapper>
    </EditorCard>
  )
}

export default CheckboxEditor
