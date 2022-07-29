import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Fade } from "@mui/material"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { NormalizedQuizItem } from "../../../../../types/types"
import Button from "../../../../shared-module/components/Button"
import { createdNewOption, deletedItem } from "../../../../store/editor/editorActions"
import { setAdvancedEditing } from "../../../../store/editor/itemVariables/itemVariableActions"
import { editedQuizItemTitle } from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import MarkdownEditor from "../../../MarkdownEditor"
import {
  AdvancedBox,
  AdvancedBoxModalOpenClass,
  CloseButton,
  DeleteButton,
  ModalButtonWrapper,
  StyledModal,
} from "../../../Shared/Modal"

import MultipleChoiceButton from "./MultipleChoiceButton"
import MultipleChoiceModalContent from "./MultipleChoiceModalContent"

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

interface MultipleChoiceContentProps {
  item: NormalizedQuizItem
}

const MultipleChoiceContent: React.FC<React.PropsWithChildren<MultipleChoiceContentProps>> = ({
  item,
}) => {
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
        onClose={() => dispatch(setAdvancedEditing({ itemId: storeItem.id, editing: false }))}
      >
        <Fade in={variables.advancedEditing}>
          <AdvancedBox
            className={AdvancedBoxModalOpenClass(variables.advancedEditingYAxisLocation)}
          >
            <ModalButtonWrapper>
              <CloseButton
                aria-label={t("close")}
                variant={"outlined"}
                size={"medium"}
                onClick={() =>
                  dispatch(setAdvancedEditing({ itemId: storeItem.id, editing: false }))
                }
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
        onChange={(value) => dispatch(editedQuizItemTitle(value.trimStart(), storeItem.id))}
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

export default MultipleChoiceContent
