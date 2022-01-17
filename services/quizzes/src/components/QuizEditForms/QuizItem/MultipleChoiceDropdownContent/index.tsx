import { faPen, faPlus, faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Box, Button, Fade, Modal } from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { NormalizedQuizItem } from "../../../../../types/types"
import { createdNewOption, deletedItem } from "../../../../store/editor/editorActions"
import { setAdvancedEditing } from "../../../../store/editor/itemVariables/itemVariableActions"
import { editedQuizItemTitle } from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import MarkdownEditor from "../../../MarkdownEditor"

import MultipleChoiceDropdownButton from "./MultiplChoiceDropdownButton"
import MultipleChoiceModalContent from "./MultipleChoiceDropdownModalContent"

const QuizContent = styled.div`
  padding: 1rem;
  display: inline;
`

const QuizContentLineContainer = styled.div`
  display: flex !important;
`

const StyledModal = styled(Modal)`
  display: flex;
  align-items: center;
  justify-content: center;
`

const AdvancedBox = styled(Box)`
  background-color: #fafafa !important;
  min-width: 80% !important;
  min-height: 50% !important;
  max-width: 80% !important;
  max-height: 50% !important;
  overflow-y: scroll !important;
`

const CloseButton = styled(Button)`
  display: flex !important;
`

const DeleteButton = styled(Button)`
  display: flex !important;
`

const ModalButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
`

interface MultiplChoiceContentProps {
  item: NormalizedQuizItem
}

const MultipleChoiceContent: React.FC<MultiplChoiceContentProps> = ({ item }) => {
  const { t } = useTranslation()
  const quizId = useTypedSelector((state) => state.editor.quizId)
  const storeOptions = useTypedSelector((state) => state.editor.options)
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])
  const dispatch = useDispatch()
  return (
    <>
      <StyledModal
        open={variables.advancedEditing}
        onClose={() => dispatch(setAdvancedEditing(storeItem.id, false))}
      >
        <Fade in={variables.advancedEditing}>
          <AdvancedBox>
            <ModalButtonWrapper>
              <CloseButton onClick={() => dispatch(setAdvancedEditing(storeItem.id, false))}>
                <FontAwesomeIcon icon={faWindowClose} size="2x" />
              </CloseButton>
            </ModalButtonWrapper>
            <MultipleChoiceModalContent item={storeItem} />
            <ModalButtonWrapper>
              <DeleteButton
                onClick={() => {
                  dispatch(deletedItem(storeItem.id, quizId))
                }}
              >
                <FontAwesomeIcon icon={faTrash} size="2x" color="red" />
              </DeleteButton>
            </ModalButtonWrapper>
          </AdvancedBox>
        </Fade>
      </StyledModal>
      <QuizContentLineContainer>
        <QuizContent>
          <MarkdownEditor
            label={t("title")}
            text={storeItem.title ?? ""}
            onChange={(value) => dispatch(editedQuizItemTitle(value, storeItem.id))}
          />
        </QuizContent>
        {storeItem.options.map((option) => (
          <QuizContent key={option}>
            <MultipleChoiceDropdownButton option={storeOptions[option]} />
          </QuizContent>
        ))}
        <QuizContent>
          <Button title={t("add-option")} onClick={() => dispatch(createdNewOption(storeItem.id))}>
            <FontAwesomeIcon icon={faPlus} size="2x" color="blue" />
          </Button>
        </QuizContent>
      </QuizContentLineContainer>
    </>
  )
}

export default MultipleChoiceContent
