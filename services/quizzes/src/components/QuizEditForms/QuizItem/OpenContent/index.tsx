import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Box, Fade } from "@mui/material"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { NormalizedQuizItem } from "../../../../../types/types"
import Button from "../../../../shared-module/components/Button"
import TextField from "../../../../shared-module/components/InputFields/TextField"
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
import { editedFormatRegex, editedValidityRegex } from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import {
  AdvancedBox,
  AdvancedBoxModalOpenClass,
  CloseButton,
  DeleteButton,
  ModalButtonWrapper,
  StyledModal,
} from "../../../Shared/Modal"

import FormatRegexTesterModalContent from "./FormatRegexTesterModalContent"
import OpenModalContent from "./OpenModalContent"
import ValidityRegexTesterModalContent from "./ValidityRegexTesterModalContent"

const StyledButton = styled(Button)`
  display: flex;
  width: 20%;
  margin-left: 0.5rem;
`

const RegexContainer = styled.div`
  display: flex;
  margin: 1rem 0;
`

const StyledBox = styled(Box)`
  background-color: #fafafa;
  min-width: 300px;
  min-height: 300px;
`
interface OpenContentProps {
  item: NormalizedQuizItem
}

const OpenContent: React.FC<React.PropsWithChildren<OpenContentProps>> = ({ item }) => {
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
        onClose={() => dispatch(setAdvancedEditing({ itemId: storeItem.id, editing: false }))}
      >
        <Fade in={variables.advancedEditing}>
          <AdvancedBox
            className={AdvancedBoxModalOpenClass(variables.advancedEditingYAxisLocation)}
          >
            <ModalButtonWrapper>
              <CloseButton
                aria-label={t("close")}
                size="medium"
                variant="outlined"
                onClick={() =>
                  dispatch(setAdvancedEditing({ itemId: storeItem.id, editing: false }))
                }
              >
                <FontAwesomeIcon icon={faWindowClose} size="2x" />
              </CloseButton>
            </ModalButtonWrapper>
            <OpenModalContent item={storeItem} />
            <ModalButtonWrapper>
              <DeleteButton
                size="medium"
                variant="outlined"
                onClick={() => dispatch(deletedItem(storeItem.id, quizId))}
              >
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
              aria-label={t("close")}
              onClick={() => dispatch(toggleValidRegexTestingState(storeItem.id, false))}
              size="medium"
              variant="outlined"
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
              aria-label={t("close")}
              onClick={() => dispatch(toggleFormatRegexTestingState(storeItem.id, false))}
              size="medium"
              variant="outlined"
            >
              <FontAwesomeIcon icon={faWindowClose} size="2x" />
            </CloseButton>
          </ModalButtonWrapper>
          <FormatRegexTesterModalContent item={item} />
        </StyledBox>
      </StyledModal>
      <RegexContainer>
        <TextField
          error={!variables.validRegex ? t("error-title") : undefined}
          label={t("validity-regular-expression")}
          value={variables.regex ?? ""}
          onChange={(value) => {
            dispatch(setValidityTestRegex(storeItem.id, value))
            handleValidRegexChange(value)
          }}
          className={css`
            flex: 1;
          `}
        />
        {!variables.validRegex && <div>{t("invalid-regular-expression")}</div>}
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
          error={!variables.validFormatRegex ? t("error-title") : undefined}
          label={t("format-regular-expression")}
          value={variables.formatRegex ?? ""}
          onChange={(value) => {
            dispatch(setFormatTestRegex(storeItem.id, value))
            handleFormatRegexChange(value)
          }}
          className={css`
            flex: 1;
          `}
        />
        {!variables.validFormatRegex && <div>{t("invalid-regular-expression")}</div>}
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
