import { Checkbox, FormControl, FormControlLabel } from "@material-ui/core"
import React from "react"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import {
  editedOptionCorrectness,
  editedOptionFailureMessage,
  editedOptionSuccessMessage,
  editedOptionTitle,
} from "../../../../store/editor/options/optionActions"
import { useTypedSelector } from "../../../../store/store"
import { NormalizedQuizItemOption } from "../../../../types/types"
import MarkdownEditor from "../../../MarkdownEditor"

const ModalContent = styled.div`
  padding: 1rem;
  display: flex;
`

interface OptionEditorProps {
  option: NormalizedQuizItemOption
}

export const OptionModalContent: React.FC<OptionEditorProps> = ({ option }) => {
  const storeOption = useTypedSelector((state) => state.editor.options[option.id])
  const dispatch = useDispatch()
  return (
    <>
      <ModalContent>
        <p>Editing Option</p>
      </ModalContent>
      <ModalContent>
        <FormControl>
          <FormControlLabel
            label="Correct"
            labelPlacement="start"
            control={
              <Checkbox
                color="primary"
                checked={storeOption.correct}
                onChange={(event) =>
                  dispatch(editedOptionCorrectness(storeOption.id, event.target.checked))
                }
              />
            }
          />
        </FormControl>
      </ModalContent>
      <ModalContent>
        <MarkdownEditor
          label="Option title"
          text={storeOption.title ?? ""}
          onChange={(event) => dispatch(editedOptionTitle(event.target.value, storeOption.id))}
        />
      </ModalContent>
      <ModalContent>
        <MarkdownEditor
          label={storeOption.correct ? "Success message" : "Failure message"}
          text={
            storeOption.correct
              ? storeOption.successMessage ?? ""
              : storeOption.failureMessage ?? ""
          }
          onChange={
            storeOption.correct
              ? (event) => dispatch(editedOptionSuccessMessage(storeOption.id, event.target.value))
              : (event) => dispatch(editedOptionFailureMessage(storeOption.id, event.target.value))
          }
        />
      </ModalContent>
    </>
  )
}

export default OptionModalContent
