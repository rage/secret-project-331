import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { editedQuizzesSubmitmessage } from "../../store/editor/quiz/quizActions"
import { useTypedSelector } from "../../store/store"
import MarkdownEditor from "../MarkdownEditor"

const InfoContainer = styled.div`
  padding: 1rem 0;
  display: flex;
`

const BasicInformation: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const quizId = useTypedSelector((state) => state.editor.quizId)

  const submitMessage = useTypedSelector((state) => state.editor.quizzes[quizId].submitMessage)

  return (
    <>
      <InfoContainer>
        <MarkdownEditor
          text={submitMessage ?? ""}
          label={t("submit-message")}
          onChange={(value) => dispatch(editedQuizzesSubmitmessage(quizId, value))}
        />
      </InfoContainer>
    </>
  )
}

export default BasicInformation
