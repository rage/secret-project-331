import { faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Box, Button, Fade, Modal } from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { NormalizedQuizItemOption } from "../../../../../types/types"
import { deletedOption } from "../../../../store/editor/editorActions"
import { setOptionEditing } from "../../../../store/editor/optionVariables/optionVariableActions"
import { useTypedSelector } from "../../../../store/store"

import OptionModalContent from "./OptionModalContent"

const StyledModal = styled(Modal)`
  display: flex;
  align-items: center;
  justify-content: center;
`

const StyledBox = styled(Box)`
  background-color: #fafafa;
  min-width: 50% !important;
`

const CloseButton = styled(Button)`
  padding: 1rem !important;
  float: right;
`

const DeleteOptionButton = styled(Button)`
  display: flex !important;
  padding: 1rem !important;
  float: right;
`

const CorrectButton = styled(Button)`
  display: flex;
  border-width: 5px 5px 5px 5px !important;
  border-color: green !important;
  @media only screen and (max-width: 600px) {
    width: 100% !important;
  }
`

const IncorrectButton = styled(Button)`
  display: flex;
  border-width: 5px 5px 5px 5px !important;
  border-color: red !important;
  @media only screen and (max-width: 600px) {
    width: 100% !important;
  }
`

interface MultipleChoiceButtonProps {
  option: NormalizedQuizItemOption
  index: number
}

const ClickableMultipleChoiceButton: React.FC<MultipleChoiceButtonProps> = ({ option, index }) => {
  const { t } = useTranslation()
  const storeOption = useTypedSelector((state) => state.editor.options[option.id])
  const storeItem = useTypedSelector((state) => state.editor.items[option.quizItemId])
  const variables = useTypedSelector((state) => state.editor.optionVariables[option.id])
  const dispatch = useDispatch()

  const ariaLablel = t("aria-label-option-index", { index })

  return (
    <>
      <StyledModal
        open={variables.optionEditing}
        onClose={() => dispatch(setOptionEditing(storeOption.id, false))}
      >
        <Fade in={variables.optionEditing}>
          <StyledBox>
            <CloseButton
              aria-label={t("close")}
              onClick={() => dispatch(setOptionEditing(storeOption.id, false))}
            >
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
      {storeItem.allAnswersCorrect ? (
        <>
          <CorrectButton
            aria-label={ariaLablel}
            onClick={() => dispatch(setOptionEditing(storeOption.id, true))}
            variant="outlined"
          >
            {storeOption.title}
          </CorrectButton>
        </>
      ) : (
        <>
          {storeOption.correct ? (
            <>
              <CorrectButton
                aria-label={ariaLablel}
                onClick={() => dispatch(setOptionEditing(storeOption.id, true))}
                variant="outlined"
              >
                {storeOption.title}
              </CorrectButton>
            </>
          ) : (
            <>
              <IncorrectButton
                aria-label={ariaLablel}
                onClick={() => dispatch(setOptionEditing(storeOption.id, true))}
                variant="outlined"
              >
                {storeOption.title}
              </IncorrectButton>
            </>
          )}
        </>
      )}
    </>
  )
}

export default ClickableMultipleChoiceButton
