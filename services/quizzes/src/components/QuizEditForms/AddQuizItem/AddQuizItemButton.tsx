import { Button } from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { createdNewItem } from "../../../store/editor/editorActions"
import { useTypedSelector } from "../../../store/store"

// eslint-disable-next-line i18next/no-literal-string
const StyledButton = styled(Button)`
  display: flex !important;
  background: #e0e0e0 !important;
  width: 16% !important;
  overflow: hidden !important;
  margin-top: 1rem !important;
  @media only screen and (max-width: 600px) {
    display: flex !important;
    background: #e0e0e0 !important;
    width: 100% !important;
    overflow: hidden !important;
  }
`

interface ButtonProps {
  type: string
}

export const AddQuizItemButton: React.FC<ButtonProps> = ({ type }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const quizId = useTypedSelector((state) => state.editor.quizId)
  return (
    <>
      <StyledButton
        title={t("open")}
        variant="outlined"
        onClick={() => dispatch(createdNewItem(quizId, type))}
      >
        {type}
      </StyledButton>
    </>
  )
}

export default AddQuizItemButton
