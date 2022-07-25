import styled from "@emotion/styled"
import { FormControlLabel, FormGroup, Radio, TextField } from "@mui/material"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { NormalizedQuizItem } from "../../../../../types/types"
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
export const ScaleModalContent: React.FC<React.PropsWithChildren<ScaleItemEditorModalProps>> = ({
  item,
}) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])
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
          error={!minValid}
          helperText={!minValid ? t("invalid-minimum-value") : ""}
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
          error={!maxValid}
          helperText={!maxValid ? t("invalid-maximum-value") : ""}
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
