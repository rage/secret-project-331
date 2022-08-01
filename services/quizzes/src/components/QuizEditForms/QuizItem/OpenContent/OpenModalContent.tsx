import styled from "@emotion/styled"
import { Button, Checkbox, FormControl, FormControlLabel, TextField } from "@mui/material"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { NormalizedQuizItem } from "../../../../../types/types"
import {
  setValidityTestRegex,
  setValidValidityRegex,
  toggleValidRegexTestingState,
} from "../../../../store/editor/itemVariables/itemVariableActions"
import {
  editedItemFailureMessage,
  editedItemSuccessMessage,
  editedQuizItemBody,
  editedQuizItemTitle,
  editedValidityRegex,
  toggledMultiOptions,
} from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import MarkdownEditor from "../../../MarkdownEditor"

const ModalContent = styled.div`
  padding: 1rem;
  display: flex;
`

const StyledButton = styled(Button)`
  display: flex;
  width: 20%;
  margin-left: 0.5rem !important;
`

const ModalContentTitleWrapper = styled.div`
  display: flex;
  padding: 1rem;
  justify-content: center;
`

interface ModalContentProps {
  item: NormalizedQuizItem
}

export const OpenModalContent: React.FC<React.PropsWithChildren<ModalContentProps>> = ({
  item,
}) => {
  const { t } = useTranslation()
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])
  const dispatch = useDispatch()

  const handleRegexChange = (input: string): void => {
    try {
      new RegExp(input)
      dispatch(editedValidityRegex(item.id, input))
      dispatch(setValidValidityRegex(storeItem.id, true))
    } catch (err) {
      dispatch(setValidValidityRegex(storeItem.id, false))
    }
  }

  return (
    <>
      <ModalContentTitleWrapper>
        <h3>{t("title-advanced-editing")}</h3>
      </ModalContentTitleWrapper>
      <ModalContent>
        <MarkdownEditor
          label={t("title")}
          text={storeItem.title ?? ""}
          onChange={(value) => dispatch(editedQuizItemTitle(value, storeItem.id))}
        />
      </ModalContent>
      <ModalContent>
        <MarkdownEditor
          label={t("body")}
          text={storeItem.body ?? ""}
          onChange={(value) => dispatch(editedQuizItemBody(value, storeItem.id))}
        />
      </ModalContent>
      <ModalContent>
        <TextField
          error={!variables.validRegex}
          fullWidth
          label={t("validity-regular-expression")}
          variant="outlined"
          value={variables.regex ?? ""}
          helperText={!variables.validRegex && t("invalid-regular-expression")}
          onChange={(event) => {
            dispatch(setValidityTestRegex(storeItem.id, event.target.value))
            handleRegexChange(event.target.value)
          }}
        />
        <StyledButton
          variant="outlined"
          onClick={() => dispatch(toggleValidRegexTestingState(storeItem.id, true))}
          size="large"
        >
          {t("label-test")}
        </StyledButton>
      </ModalContent>
      <ModalContent>
        <FormControl>
          <FormControlLabel
            label={t("allow-selecting-multiple-options")}
            labelPlacement="start"
            control={
              <Checkbox
                color="primary"
                checked={storeItem.multi}
                onChange={(event) =>
                  dispatch(toggledMultiOptions(storeItem.id, event.target.checked))
                }
              />
            }
          />
        </FormControl>
      </ModalContent>
      <ModalContent>
        <MarkdownEditor
          label={t("success-message")}
          text={storeItem.successMessage ?? ""}
          onChange={(value) => dispatch(editedItemSuccessMessage(storeItem.id, value))}
        />
      </ModalContent>
      <ModalContent>
        <MarkdownEditor
          label={t("failure-message")}
          text={storeItem.failureMessage ?? ""}
          onChange={(value) => dispatch(editedItemFailureMessage(storeItem.id, value))}
        />
      </ModalContent>
    </>
  )
}

export default OpenModalContent
