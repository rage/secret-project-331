import { faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Button, Checkbox, FormControlLabel, FormGroup } from "@material-ui/core"
import React from "react"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { createdNewOption } from "../../../../store/editor/editorActions"
import {
  editedItemFailureMessage,
  editedItemSuccessMessage,
  editedQuizItemTitle,
  editedSharedOptionsFeedbackMessage,
  toggledMultiOptions,
  toggledSharedOptionFeedbackMessage,
} from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import { NormalizedItem } from "../../../../types/NormalizedQuiz"
import MarkdownEditor from "../../../MarkdownEditor"
import { ModalContent, ModalContentTitleWrapper } from "../../../Shared/Modal"

import MultipleChoiceButton from "./ClickableMultiplChoiceButton"

const ModalContentOptionWrapper = styled.div`
  padding: 1rem;
  display: flex;
  justify-content: space-evenly;
`

interface EditorModalProps {
  item: NormalizedItem
}

export const MultipleChoiceModalContent: React.FC<EditorModalProps> = ({ item }) => {
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const storeOptions = useTypedSelector((state) => state.editor.options)
  const dispatch = useDispatch()
  return (
    <>
      <ModalContentTitleWrapper>
        <h4>Advanced editing</h4>
      </ModalContentTitleWrapper>
      <ModalContent>
        <FormGroup row>
          <FormControlLabel
            label="Shared feedback message"
            labelPlacement="start"
            control={
              <Checkbox
                color="primary"
                checked={storeItem.usesSharedOptionFeedbackMessage}
                onChange={(event) =>
                  dispatch(toggledSharedOptionFeedbackMessage(storeItem.id, event.target.checked))
                }
              />
            }
          />
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
        </FormGroup>
      </ModalContent>
      <ModalContent>
        <MarkdownEditor
          label="Title"
          text={storeItem.title ?? ""}
          onChange={(event) => dispatch(editedQuizItemTitle(event.target.value, storeItem.id))}
        />
      </ModalContent>
      <ModalContent>
        <Button title="add option" onClick={() => dispatch(createdNewOption(storeItem.id))}>
          <FontAwesomeIcon icon={faPlus} size="2x" color="blue" />
        </Button>
      </ModalContent>
      <ModalContentOptionWrapper>
        {storeItem.options.map((option) => (
          <ModalContent key={option}>
            <MultipleChoiceButton option={storeOptions[option]} />
          </ModalContent>
        ))}
      </ModalContentOptionWrapper>
      {storeItem.usesSharedOptionFeedbackMessage ? (
        <ModalContent>
          <MarkdownEditor
            label="Shared option feedback message"
            text={storeItem.sharedOptionFeedbackMessage ?? ""}
            onChange={(event) =>
              dispatch(editedSharedOptionsFeedbackMessage(storeItem.id, event.target.value))
            }
          />
        </ModalContent>
      ) : (
        <>
          <ModalContent>
            <MarkdownEditor
              label="Success message"
              text={storeItem.successMessage ?? ""}
              onChange={(event) =>
                dispatch(editedItemSuccessMessage(storeItem.id, event.target.value))
              }
            />
          </ModalContent>
          <ModalContent>
            <MarkdownEditor
              label="Failure message"
              text={storeItem.failureMessage ?? ""}
              onChange={(event) =>
                dispatch(editedItemFailureMessage(storeItem.id, event.target.value))
              }
            />
          </ModalContent>
        </>
      )}
    </>
  )
}

export default MultipleChoiceModalContent
