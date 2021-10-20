import { FormControlLabel, FormGroup, Radio, TextField } from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import {
  setScaleMax,
  setScaleMin,
} from "../../../../store/editor/itemVariables/itemVariableActions"
import {
  editedQuizItemTitle,
  editedScaleMaxValue,
  editedScaleMinValue,
} from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import { NormalizedQuizItem } from "../../../../types/types"

const ModalContent = styled.div`
  padding: 1rem;
  display: flex;
`

const ValueFieldContainer = styled(TextField)`
  margin-left: 0.5rem !important;
`

const PreviewModalContainer = styled.div`
  padding: 1rem !important;
  justify-content: center !important;
  display: flex !important;
`

const StyledFormLabel = styled(FormControlLabel)`
  margin-left: 0px !important;
  margin-right: 0px !important;
`

const ModalContentTitleWrapper = styled.div`
  display: flex;
  padding: 1rem;
  justify-content: center;
`

interface ScaleItemEditorModalProps {
  item: NormalizedQuizItem
}
export const ScaleModalContent: React.FC<ScaleItemEditorModalProps> = ({ item }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])

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
      <ModalContentTitleWrapper>
        <h4>{t("title-advanced-editing")}</h4>
      </ModalContentTitleWrapper>
      <ModalContent>
        <TextField
          label={t("title")}
          value={storeItem.title}
          fullWidth
          multiline
          variant="outlined"
          onChange={(event) => dispatch(editedQuizItemTitle(event.target.value, storeItem.id))}
        />
      </ModalContent>
      <ModalContent>
        <ValueFieldContainer
          error={!variables.validMin}
          helperText={!variables.validMin ? t("invalid-minimum-value") : ""}
          type="number"
          label={t("minimum")}
          value={variables.scaleMin ?? ""}
          fullWidth
          variant="outlined"
          onChange={(event) => handleMinValueChange(Number(event.target.value))}
        />
      </ModalContent>
      <ModalContent>
        <ValueFieldContainer
          error={!variables.validMax}
          helperText={!variables.validMax ? t("invalid-maximum-value") : ""}
          type="number"
          label={t("maximum")}
          value={variables.scaleMax ?? ""}
          fullWidth
          variant="outlined"
          onChange={(event) => handleMaxValueChange(Number(event.target.value))}
        />
      </ModalContent>
      <PreviewModalContainer>
        <FormGroup row>
          {variables.array.map((item) => {
            return (
              <div key={item}>
                <StyledFormLabel disabled control={<Radio />} label={item} labelPlacement="top" />
              </div>
            )
          })}
        </FormGroup>
      </PreviewModalContainer>
    </>
  )
}

export default ScaleModalContent
