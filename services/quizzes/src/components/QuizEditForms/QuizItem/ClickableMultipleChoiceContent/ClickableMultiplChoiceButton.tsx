import { faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Box, Button, Fade, Modal } from "@material-ui/core"
import React from "react"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { deletedOption } from "../../../../store/editor/editorActions"
import { setOptionEditing } from "../../../../store/editor/optionVariables/optionVariableActions"
import { useTypedSelector } from "../../../../store/store"
import { NormalizedOption } from "../../../../types/NormalizedQuiz"

import OptionModalContent from "./OptionModalContent"

const StyledModal = styled(Modal)`
  display: flex;
  align-items: center;
  justify-content: center;
`

const StyledBox = styled(Box)`
  background-color: #fafafa;
  min-width: 700px;
  min-height: 500px;
`

const CloseButton = styled(Button)`
  padding: 1rem !important;
  float: right;
`

const DeleteOptionButton = styled(Button)`
  display: flex;
  padding: 1rem !important;
  position: relative !important;
  left: 85% !important;
`

const CorrectButton = styled(Button)`
  display: flex;
  border-width: 5px 5px 5px 5px !important;
  border-color: green !important;
`

const IncorrectButton = styled(Button)`
  display: flex;
  border-width: 5px 5px 5px 5px !important;
  border-color: red !important;
`

interface clickableMultipleChoiceButtonProps {
  option: NormalizedOption
}

const ClickableMultipleChoiceButton: React.FC<clickableMultipleChoiceButtonProps> = ({
  option,
}) => {
  const storeOption = useTypedSelector((state) => state.editor.options[option.id])
  const variables = useTypedSelector((state) => state.editor.optionVariables[option.id])
  const dispatch = useDispatch()

  return (
    <>
      <StyledModal
        open={variables.optionEditing}
        onClose={() => dispatch(setOptionEditing(storeOption.id, false))}
      >
        <Fade in={variables.optionEditing}>
          <StyledBox>
            <CloseButton onClick={() => dispatch(setOptionEditing(storeOption.id, false))}>
              <FontAwesomeIcon icon={faWindowClose} size="2x" />
            </CloseButton>
            <OptionModalContent option={storeOption} />
            <DeleteOptionButton
              onClick={() => {
                dispatch(setOptionEditing(storeOption.id, false))
                dispatch(deletedOption(storeOption.id, storeOption.quizItemId))
              }}
            >
              <FontAwesomeIcon icon={faTrash} size="2x" color="red" />
            </DeleteOptionButton>
          </StyledBox>
        </Fade>
      </StyledModal>
      {storeOption.correct ? (
        <>
          <CorrectButton
            onClick={() => dispatch(setOptionEditing(storeOption.id, true))}
            variant="outlined"
          >
            {storeOption.title}
          </CorrectButton>
        </>
      ) : (
        <>
          <IncorrectButton
            onClick={() => dispatch(setOptionEditing(storeOption.id, true))}
            variant="outlined"
          >
            {storeOption.title}
          </IncorrectButton>
        </>
      )}
    </>
  )
}

export default ClickableMultipleChoiceButton
