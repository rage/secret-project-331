import { faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Button, Checkbox, FormControlLabel, FormGroup } from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { NormalizedQuizItem } from "../../../../../types/types"
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
import MarkdownEditor from "../../../MarkdownEditor"
import { ModalContent, ModalContentTitleWrapper } from "../../../Shared/Modal"

import MultipleChoiceButton from "./ClickableMultiplChoiceButton"

const ModalContentOptionWrapper = styled.div`
  padding: 1rem;
  display: flex;
  justify-content: space-evenly;
`

interface EditorModalProps {
  item: NormalizedQuizItem
}

export const MultipleChoiceModalContent: React.FC<EditorModalProps> = ({ item }) => {
  const { t } = useTranslation()
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const storeOptions = useTypedSelector((state) => state.editor.options)
  const dispatch = useDispatch()
  return (
    <>
      <ModalContentTitleWrapper>
        <h4>{t("title-advanced-editing")}</h4>
      </ModalContentTitleWrapper>
      <ModalContent>
        <FormGroup row>
          <FormControlLabel
            label={t("shared-feedback-message")}
            // eslint-disable-next-line i18next/no-literal-string
            labelPlacement="start"
            control={
              <Checkbox
                // eslint-disable-next-line i18next/no-literal-string
                color="primary"
                checked={storeItem.usesSharedOptionFeedbackMessage}
                onChange={(event) =>
                  dispatch(toggledSharedOptionFeedbackMessage(storeItem.id, event.target.checked))
                }
              />
            }
          />
          <FormControlLabel
            label={t("allow-selecting-multiple-options")}
            // eslint-disable-next-line i18next/no-literal-string
            labelPlacement="start"
            control={
              <Checkbox
                // eslint-disable-next-line i18next/no-literal-string
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
          label={t("title")}
          text={storeItem.title ?? ""}
          onChange={(value) => dispatch(editedQuizItemTitle(value, storeItem.id))}
        />
      </ModalContent>
      <ModalContent>
        <Button title={t("add-option")} onClick={() => dispatch(createdNewOption(storeItem.id))}>
          {/* eslint-disable-next-line i18next/no-literal-string */}
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
            label={t("shared-feedback-message-option")}
            text={storeItem.sharedOptionFeedbackMessage ?? ""}
            onChange={(value) => dispatch(editedSharedOptionsFeedbackMessage(storeItem.id, value))}
          />
        </ModalContent>
      ) : (
        <>
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
      )}
    </>
  )
}

export default MultipleChoiceModalContent
