import { Button, Checkbox, FormControl, FormControlLabel, TextField } from "@material-ui/core"
import React from "react"
import { useDispatch } from "react-redux"
import styled from "styled-components"

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
import { NormalizedItem } from "../../../../types/types"
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
  item: NormalizedItem
}

export const OpenModalContent: React.FC<ModalContentProps> = ({ item }) => {
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
        <h3>Advanced Editing</h3>
      </ModalContentTitleWrapper>
      <ModalContent>
        <MarkdownEditor
          label="Title"
          text={storeItem.title ?? ""}
          onChange={(event) => dispatch(editedQuizItemTitle(event.target.value, storeItem.id))}
        />
      </ModalContent>
      <ModalContent>
        <MarkdownEditor
          label="Body"
          text={storeItem.body ?? ""}
          onChange={(event) => dispatch(editedQuizItemBody(event.target.value, storeItem.id))}
        />
      </ModalContent>
      <ModalContent>
        <TextField
          error={!variables.validRegex}
          fullWidth
          label="Validity regex"
          variant="outlined"
          value={variables.regex ?? ""}
          helperText={!variables.validRegex && "Invalid regex"}
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
          Test Regex
        </StyledButton>
      </ModalContent>
      <ModalContent>
        <FormControl>
          <FormControlLabel
            label="Multi"
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
          label="Success message"
          text={storeItem.successMessage ?? ""}
          onChange={(event) => dispatch(editedItemSuccessMessage(storeItem.id, event.target.value))}
        />
      </ModalContent>
      <ModalContent>
        <MarkdownEditor
          label="Failure message"
          text={storeItem.failureMessage ?? ""}
          onChange={(event) => dispatch(editedItemFailureMessage(storeItem.id, event.target.value))}
        />
      </ModalContent>
    </>
  )
}

export default OpenModalContent
