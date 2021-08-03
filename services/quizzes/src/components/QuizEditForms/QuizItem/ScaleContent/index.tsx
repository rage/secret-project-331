import { faPen, faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  Box,
  Button,
  Fade,
  FormControlLabel,
  FormGroup,
  Modal,
  Radio,
  TextField,
} from "@material-ui/core"
import React from "react"
import { useDispatch } from "react-redux"
import styled from "styled-components"

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
import { NormalizedItem } from "../../../../types/NormalizedQuiz"
import MarkdownEditor from "../../../MarkdownEditor"

import ScaleModalContent from "./ScaleModalContent"

const ScaleContainer = styled.div`
  padding-top: 1rem;
  padding-bottom: 1rem;
  display: flex;
`

const PreviewContainer = styled.div`
  width: 50% !important;
  justify-content: center !important;
  display: flex !important;
`

const MinMaxContainer = styled.div`
  width: 50% !important;
  display: flex;
`

const MinField = styled(TextField)`
  margin-right: 1rem !important;
  display: flex;
`

const MaxField = styled(TextField)`
  margin-left: 0.5rem !important;
  display: flex;
`

const StyledFormLabel = styled(FormControlLabel)`
  margin-left: 0px !important;
  margin-right: 0px !important;
`

const EditButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end !important;
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

interface ScaleContentProps {
  item: NormalizedItem
}
const ScaleContent: React.FC<ScaleContentProps> = ({ item }) => {
  const quizId = useTypedSelector((state) => state.editor.quizId)
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])
  const dispatch = useDispatch()

  const handleMinValueChange = (value: number) => {
    if (value >= 0 && value < variables.scaleMax) {
      dispatch(setScaleMin(storeItem.id, value, true))
      dispatch(editedScaleMinValue(storeItem.id, value))
    } else {
      dispatch(setScaleMin(storeItem.id, value, false))
    }
  }

  const handleMaxValueChange = (value: number) => {
    if (value >= 0 && value > variables.scaleMin && value < 11) {
      dispatch(setScaleMax(storeItem.id, value, true))
      dispatch(editedScaleMaxValue(storeItem.id, value))
    } else {
      dispatch(setScaleMax(storeItem.id, value, false))
    }
  }

  return (
    <>
      <EditButtonWrapper>
        <Button onClick={() => dispatch(setAdvancedEditing(storeItem.id, true))} title="edit item">
          <FontAwesomeIcon icon={faPen} size="2x"></FontAwesomeIcon>
        </Button>
      </EditButtonWrapper>
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
          label="Title"
          text={storeItem.title ?? ""}
          onChange={(event) => dispatch(editedQuizItemTitle(event.target.value, storeItem.id))}
        />
        <PreviewContainer>
          <FormGroup row>
            {variables.array.map((item) => {
              return (
                <div key={item}>
                  <StyledFormLabel disabled control={<Radio />} label={item} labelPlacement="top" />
                </div>
              )
            })}
          </FormGroup>
        </PreviewContainer>
      </ScaleContainer>
      <MinMaxContainer>
        <MinField
          error={!variables.validMin}
          helperText={!variables.validMin ? "invalid min value" : ""}
          label="min"
          value={variables.scaleMin ?? ""}
          variant="outlined"
          type="number"
          onChange={(event) => handleMinValueChange(Number(event.target.value))}
        />
        <MaxField
          error={!variables.validMax}
          helperText={!variables.validMax ? "invalid max value" : ""}
          label="max"
          value={variables.scaleMax ?? ""}
          variant="outlined"
          type="number"
          onChange={(event) => handleMaxValueChange(Number(event.target.value))}
        />
      </MinMaxContainer>
    </>
  )
}

export default ScaleContent
