import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuizItemScale } from "../../../../../types/quizTypes"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import EditorCard from "../common/EditorCard"

interface ScaleEditorProps {
  quizItem: PrivateSpecQuizItemScale
}

const TextFieldContainer = styled.div`
  display: flex;
`

const TextFieldWrapper = styled.div`
  width: 90%;
  margin: 0px 4px;
`

const ScaleEditor: React.FC<ScaleEditorProps> = ({ quizItem }) => {
  const { t } = useTranslation()

  return (
    <EditorCard title={t("quiz-scale-name")}>
      <TextField value={quizItem.title} label={t("option-title")} name={t("option-title")} />
      <TextFieldContainer>
        <TextFieldWrapper>
          <TextField
            type={"number"}
            value={quizItem.minValue ?? 0}
            label={t("minimum")}
            name={t("minimum")}
          />
        </TextFieldWrapper>
        <TextFieldWrapper>
          <TextField
            type={"number"}
            value={quizItem.maxValue ?? 0}
            label={t("maximum")}
            name={t("maximum")}
          />
        </TextFieldWrapper>
      </TextFieldContainer>
    </EditorCard>
  )
}

export default ScaleEditor
