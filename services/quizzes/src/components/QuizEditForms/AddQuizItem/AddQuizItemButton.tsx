import { Button } from "@material-ui/core"
import React from "react"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { createdNewItem } from "../../../store/editor/editorActions"
import { useTypedSelector } from "../../../store/store"

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
  const dispatch = useDispatch()
  const quizId = useTypedSelector((state) => state.editor.quizId)
  const state = useTypedSelector((state) => state)
  console.log("HIP", quizId)
  console.log("state", state)
  return (
    <>
      <StyledButton
        title="open"
        variant="outlined"
        onClick={() => dispatch(createdNewItem(quizId, type))}
      >
        {type}
      </StyledButton>
    </>
  )
}

export default AddQuizItemButton
