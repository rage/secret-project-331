import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuizItemEssay } from "../../../../../types/quizTypes"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import EditorCard from "../common/EditorCard"

interface EssayEditorProps {
  quizItem: PrivateSpecQuizItemEssay
}

const TextFieldContainer = styled.div`
  display: flex;
`

const TextFieldWrapper = styled.div`
  width: 90%;
  margin: 0px 4px;
`

const EssayEditor: React.FC<EssayEditorProps> = ({ quizItem }) => {
  const { t } = useTranslation()

  return (
    <EditorCard title={t("quiz-essay-name")}>
      <TextFieldContainer>
        <TextFieldWrapper>
          <TextField
            type={"number"}
            value={quizItem.minWords ?? 0}
            label={t("min-words")}
            name={t("min-words")}
          />
        </TextFieldWrapper>
        <TextFieldWrapper>
          <TextField
            type={"number"}
            value={quizItem.maxWords ?? 0}
            label={t("max-words")}
            name={t("max-words")}
          />
        </TextFieldWrapper>
      </TextFieldContainer>
    </EditorCard>
  )
}

export default EssayEditor
