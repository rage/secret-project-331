import { faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Box, Button, Fade, Modal } from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { NormalizedQuizItem } from "../../../../../types/types"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import { deletedItem } from "../../../../store/editor/editorActions"
import {
  setAdvancedEditing,
  setScaleMax,
  setScaleMin,
} from "../../../../store/editor/itemVariables/itemVariableActions"
import {
  editedQuizItemTitle,
  editedScaleMaxValue,
  editedScaleMinValue,
} from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import MarkdownEditor from "../../../MarkdownEditor"

import ScaleModalContent from "./ScaleModalContent"

const ScaleContainer = styled.div`
  padding-top: 1rem;
  padding-bottom: 1rem;
`

const MinMaxContainer = styled.div`
  display: flex;
`

const MinField = styled(TextField)`
  margin-right: 1rem !important;
  width: 100%;
`

const MaxField = styled(TextField)`
  margin-left: 0.5rem !important;
  width: 100%;
`

const StyledModal = styled(Modal)`
  display: flex;
  align-items: center;
  justify-content: center;
`

const AdvancedBox = styled(Box)`
  background-color: #fafafa !important;
  min-width: 80% !important;
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

interface ScaleContentProps {
  item: NormalizedQuizItem
}
const ScaleContent: React.FC<ScaleContentProps> = ({ item }) => {
  const { t } = useTranslation()
  const quizId = useTypedSelector((state) => state.editor.quizId)
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])
  const dispatch = useDispatch()

  const minValid = variables.scaleMin >= 0 && variables.scaleMin < variables.scaleMax
  const maxValid =
    variables.scaleMax >= 0 && variables.scaleMax > variables.scaleMin && variables.scaleMax < 11

  const handleMinValueChange = (value: number) => {
    dispatch(editedScaleMinValue(storeItem.id, value))
    dispatch(setScaleMin(storeItem.id, value))
  }

  const handleMaxValueChange = (value: number) => {
    dispatch(setScaleMax(storeItem.id, value))
    dispatch(editedScaleMaxValue(storeItem.id, value))
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
              <CloseButton
                aria-label={t("close")}
                onClick={() => dispatch(setAdvancedEditing(storeItem.id, false))}
              >
                <FontAwesomeIcon icon={faWindowClose} size="2x" />
              </CloseButton>
            </ModalButtonWrapper>
            <ScaleModalContent item={storeItem} />
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
      <ScaleContainer>
        <MarkdownEditor
          label={t("title")}
          text={storeItem.title ?? ""}
          onChange={(value) => dispatch(editedQuizItemTitle(value, storeItem.id))}
        />
      </ScaleContainer>
      <MinMaxContainer>
        <MinField
          error={!minValid}
          label={t("minimum")}
          value={variables.scaleMin?.toString() ?? ""}
          type="number"
          onChange={(value) => handleMinValueChange(Number(value))}
        />
        {!minValid && t("invalid-minimum-value")}
        <MaxField
          error={!maxValid}
          label={t("maximum")}
          value={variables.scaleMax?.toString() ?? ""}
          type="number"
          onChange={(value) => handleMaxValueChange(Number(value))}
        />
        {!maxValid && t("invalid-maximum-value")}
      </MinMaxContainer>
    </>
  )
}

export default ScaleContent
