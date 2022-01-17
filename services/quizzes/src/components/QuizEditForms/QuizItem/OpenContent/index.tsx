import { faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Box, Button, Fade, Modal, TextField } from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { NormalizedQuizItem } from "../../../../../types/types"
import { deletedItem } from "../../../../store/editor/editorActions"
import {
  setAdvancedEditing,
  setFormatTestRegex,
  setFormatValidityRegex,
  setValidityTestRegex,
  setValidValidityRegex,
  toggleFormatRegexTestingState,
  toggleValidRegexTestingState,
} from "../../../../store/editor/itemVariables/itemVariableActions"
import {
  editedFormatRegex,
  editedQuizItemBody,
  editedQuizItemTitle,
  editedValidityRegex,
} from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import MarkdownEditor from "../../../MarkdownEditor"

import FormatRegexTesterModalContent from "./FormatRegexTesterModalContent"
import OpenModalContent from "./OpenModalContent"
import ValidityRegexTesterModalContent from "./ValidityRegexTesterModalContent"

const AdvancedBox = styled(Box)`
  background-color: #fafafa !important;
  min-width: 80% !important;
  min-height: 50% !important;
  max-width: 80% !important;
  max-height: 50% !important;
  overflow-y: scroll !important;
`

const EditButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
`

const ItemInfo = styled.div`
  margin-bottom: 1rem;
  margin-top: 1rem;
`

const StyledButton = styled(Button)`
  display: flex;
  width: 20%;
  margin-left: 0.5rem;
`

const RegexContainer = styled.div`
  display: flex;
  margin: 1rem 0;
`

const StyledModal = styled(Modal)`
  display: flex;
  align-items: center;
  justify-content: center;
`

const StyledBox = styled(Box)`
  background-color: #fafafa;
  min-width: 300px;
  min-height: 300px;
  max-height: 300px;
  max-width: 300px;
`
const CloseButton = styled(Button)`
  display: flex;
`

const DeleteButton = styled(Button)`
  display: flex;
`

const ModalButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
`
interface OpenContentProps {
  item: NormalizedQuizItem
}

const OpenContent: React.FC<OpenContentProps> = ({ item }) => {
  const { t } = useTranslation()
  const quizId = useTypedSelector((state) => state.editor.quizId)
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])
  const dispatch = useDispatch()

  const handleValidRegexChange = (input: string): void => {
    try {
      dispatch(editedValidityRegex(item.id, input))
      dispatch(setValidValidityRegex(storeItem.id, true))
    } catch (err) {
      dispatch(setValidValidityRegex(storeItem.id, false))
    }
  }

  const handleFormatRegexChange = (input: string): void => {
    try {
      dispatch(editedFormatRegex(item.id, input))
      dispatch(setFormatValidityRegex(storeItem.id, true))
    } catch (err) {
      dispatch(setFormatValidityRegex(storeItem.id, false))
    }
  }

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
            <OpenModalContent item={storeItem} />
            <ModalButtonWrapper>
              <DeleteButton onClick={() => dispatch(deletedItem(storeItem.id, quizId))}>
                <FontAwesomeIcon icon={faTrash} color="red" size="2x" />
              </DeleteButton>
            </ModalButtonWrapper>
          </AdvancedBox>
        </Fade>
      </StyledModal>
      <StyledModal
        open={variables.testingRegex}
        onClose={() => dispatch(toggleValidRegexTestingState(storeItem.id, false))}
      >
        <StyledBox>
          <ModalButtonWrapper>
            <CloseButton
              onClick={() => dispatch(toggleValidRegexTestingState(storeItem.id, false))}
              size="small"
            >
              <FontAwesomeIcon icon={faWindowClose} size="2x" />
            </CloseButton>
          </ModalButtonWrapper>
          <ValidityRegexTesterModalContent item={item} />
        </StyledBox>
      </StyledModal>
      <StyledModal
        open={variables.testingFormatRegex}
        onClose={() => dispatch(toggleFormatRegexTestingState(storeItem.id, false))}
      >
        <StyledBox>
          <ModalButtonWrapper>
            <CloseButton
              onClick={() => dispatch(toggleFormatRegexTestingState(storeItem.id, false))}
              size="small"
            >
              <FontAwesomeIcon icon={faWindowClose} size="2x" />
            </CloseButton>
          </ModalButtonWrapper>
          <FormatRegexTesterModalContent item={item} />
        </StyledBox>
      </StyledModal>
      <ItemInfo>
        <MarkdownEditor
          label={t("title")}
          text={storeItem.title ?? ""}
          onChange={(value) => dispatch(editedQuizItemTitle(value, storeItem.id))}
        />
      </ItemInfo>
      <ItemInfo>
        <MarkdownEditor
          label={t("body")}
          text={storeItem.body ?? ""}
          onChange={(value) => dispatch(editedQuizItemBody(value, storeItem.id))}
        />
      </ItemInfo>
      <RegexContainer>
        <TextField
          error={!variables.validRegex}
          fullWidth
          label={t("validity-regular-expression")}
          variant="outlined"
          value={variables.regex ?? ""}
          helperText={!variables.validRegex && t("invalid-regular-expression")}
          onChange={(event) => {
            dispatch(setValidityTestRegex(storeItem.id, event.target.value))
            handleValidRegexChange(event.target.value)
          }}
        />
        <StyledButton
          variant="outlined"
          onClick={() => dispatch(toggleValidRegexTestingState(storeItem.id, true))}
          size="large"
        >
          {t("label-test")}
        </StyledButton>
      </RegexContainer>
      <RegexContainer>
        <TextField
          error={!variables.validFormatRegex}
          fullWidth
          label={t("format-regular-expression")}
          variant="outlined"
          value={variables.formatRegex ?? ""}
          helperText={!variables.validFormatRegex && t("invalid-regular-expression")}
          onChange={(event) => {
            dispatch(setFormatTestRegex(storeItem.id, event.target.value))
            handleFormatRegexChange(event.target.value)
          }}
        />
        <StyledButton
          variant="outlined"
          onClick={() => dispatch(toggleFormatRegexTestingState(storeItem.id, true))}
          size="large"
        >
          {t("label-test")}
        </StyledButton>
      </RegexContainer>
    </>
  )
}
export default OpenContent
