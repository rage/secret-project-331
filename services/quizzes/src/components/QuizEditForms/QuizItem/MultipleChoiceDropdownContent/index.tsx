import { css } from "@emotion/css"
import { faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Box, Fade, Modal } from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { NormalizedQuizItem } from "../../../../../types/types"
import Button from "../../../../shared-module/components/Button"
import { createdNewOption, deletedItem } from "../../../../store/editor/editorActions"
import { setAdvancedEditing } from "../../../../store/editor/itemVariables/itemVariableActions"
import { editedQuizItemTitle } from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import MarkdownEditor from "../../../MarkdownEditor"

import MultipleChoiceModalContent from "././MultipleChoiceDropdownModalContent"
import MultipleChoiceButton from "./MultiplChoiceDropdownButton"

const QuizContent = styled.div`
  padding: 1rem;
  display: flex;
  @media only screen and (max-width: 600px) {
    width: 100%;
  }
`

const QuizContentLineContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`

const StyledModal = styled(Modal)`
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  max-width: 100% !important;
  max-height: 100% !important;
`

const AdvancedBox = styled(Box)`
  background-color: #fafafa !important;
  max-width: 60% !important;
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

interface MultipleChoiceContentProps {
  item: NormalizedQuizItem
}

const MultipleChoiceDropdownContent: React.FC<MultipleChoiceContentProps> = ({ item }) => {
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
              <CloseButton
                variant={"outlined"}
                size={"medium"}
                onClick={() => dispatch(setAdvancedEditing(storeItem.id, false))}
              >
                <FontAwesomeIcon icon={faWindowClose} size="2x" />
              </CloseButton>
            </ModalButtonWrapper>
            <MultipleChoiceModalContent item={storeItem} />
            <ModalButtonWrapper>
              <DeleteButton
                variant={"outlined"}
                size={"medium"}
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
      <MarkdownEditor
        label={t("title")}
        onChange={(value) => dispatch(editedQuizItemTitle(value, storeItem.id))}
        text={storeItem.title ?? ""}
      />
      <h3
        className={css`
          margin-top: 1rem;
        `}
      >
        {t("title-options")}
      </h3>
      <QuizContentLineContainer>
        {storeItem.options.map((option, i) => (
          <QuizContent key={option}>
            <MultipleChoiceButton index={i + 1} option={storeOptions[option]} />
          </QuizContent>
        ))}
        <QuizContent>
          <Button
            title={t("add-option")}
            onClick={() => dispatch(createdNewOption(storeItem.id))}
            variant={"outlined"}
            size={"medium"}
          >
            {t("add-option")}
          </Button>
        </QuizContent>
      </QuizContentLineContainer>
    </>
  )
}

export default MultipleChoiceDropdownContent
