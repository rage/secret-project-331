import { faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Switch,
} from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { createdNewOption } from "../../../../store/editor/editorActions"
import {
  editedItemDirection,
  editedItemFailureMessage,
  editedItemSuccessMessage,
  editedQuizItemFeedbackDisplayPolicy,
  editedQuizItemTitle,
  editedSharedOptionsFeedbackMessage,
  toggledAllAnswersCorrect,
  toggledMultiOptions,
  toggledSharedOptionFeedbackMessage,
} from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import { NormalizedQuizItem } from "../../../../types/types"
import MarkdownEditor from "../../../MarkdownEditor"
import { ModalWrapper } from "../../../Shared/Modal"

import MultipleChoiceButton from "./MultiplChoiceButton"

const ModalContent = styled.div`
  display: flex;
  padding: 1rem;
  justify-content: center;
  @media only screen and (max-width: 600px) {
    width: 100%;
  }
`
const ModalContentTitleWrapper = styled.div`
  display: flex;
  padding: 1rem;
  justify-content: center;
  @media only screen and (max-width: 600px) {
    width: auto !important;
  }
`

const ModalContentOptionWrapper = styled.div`
  padding: 0.5rem;
  display: flex !important;
  justify-content: space-evenly !important;
  @media only screen and (max-width: 600px) {
    flex-wrap: wrap;
    width: auto;
  }
`

const AllAnswersCorrectField = styled.div`
  display: flex;
  width: 100%;
`

const Spacer = styled.div`
  margin: 5% 0;
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
    <ModalWrapper>
      <ModalContentTitleWrapper>
        <h4>{t("title-advanced-editing")}</h4>
      </ModalContentTitleWrapper>
      <ModalContent>
        <FormGroup row>
          <FormControlLabel
            label={t("shared-feedback-message")}
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
        </FormGroup>
      </ModalContent>
      <ModalContent>
        <Select
          fullWidth
          label={t("feedback-display policy")}
          variant="outlined"
          value={storeItem.feedbackDisplayPolicy}
          onChange={(event) =>
            dispatch(editedQuizItemFeedbackDisplayPolicy(storeItem.id, event.target.value))
          }
        >
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <MenuItem value="DisplayFeedbackOnQuizItem">{t("on-quiz-item")}</MenuItem>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <MenuItem value="DisplayFeedbackOnAllOptions">
            {t("on-each-quiz-item-answer-option")}
          </MenuItem>
        </Select>
      </ModalContent>
      <ModalContent>
        <MarkdownEditor
          label={t("title")}
          onChange={(event) => dispatch(editedQuizItemTitle(event.target.value, storeItem.id))}
          text={storeItem.title}
        />
      </ModalContent>
      <ModalContent>
        <AllAnswersCorrectField>
          <FormGroup row>
            <FormControlLabel
              control={
                <Switch
                  checked={storeItem.allAnswersCorrect}
                  onChange={() => dispatch(toggledAllAnswersCorrect(storeItem.id))}
                />
              }
              label={t("all-answers-correct")}
            />
          </FormGroup>
        </AllAnswersCorrectField>
      </ModalContent>
      <ModalContent>
        <Button title={t("add-option")} onClick={() => dispatch(createdNewOption(storeItem.id))}>
          <FontAwesomeIcon icon={faPlus} size="2x" color="blue" />
        </Button>
      </ModalContent>
      <ModalContentOptionWrapper>
        {storeItem.options.map((option, i) => (
          <ModalContent key={option}>
            <MultipleChoiceButton index={i + 1} option={storeOptions[option]} />
          </ModalContent>
        ))}
      </ModalContentOptionWrapper>
      <Spacer />
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <FormControl component="fieldset">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <FormLabel component="legend">{t("layout-of-options")}</FormLabel>
        <RadioGroup
          aria-label={t("direction")}
          name={t("direction")}
          value={storeItem.direction}
          onChange={(e) => dispatch(editedItemDirection(storeItem.id, e.target.value))}
        >
          <FormHelperText>{t("choose-quiz-item-option-direction-help-text")}</FormHelperText>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <FormControlLabel value="row" control={<Radio />} label={t("row")} />
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <FormControlLabel value="column" control={<Radio />} label={t("column")} />
        </RadioGroup>
      </FormControl>
      {storeItem.usesSharedOptionFeedbackMessage ? (
        <ModalContent>
          <MarkdownEditor
            label={t("shared-feedback-message-option")}
            onChange={(event) =>
              dispatch(editedSharedOptionsFeedbackMessage(storeItem.id, event.target.value))
            }
            text={storeItem.sharedOptionFeedbackMessage ?? ""}
          />
        </ModalContent>
      ) : (
        <>
          <ModalContent>
            <MarkdownEditor
              label={t("success-message")}
              onChange={(event) =>
                dispatch(editedItemSuccessMessage(storeItem.id, event.target.value))
              }
              text={storeItem.successMessage ?? ""}
            />
          </ModalContent>
          <ModalContent>
            <MarkdownEditor
              label={t("failure-message")}
              onChange={(event) =>
                dispatch(editedItemFailureMessage(storeItem.id, event.target.value))
              }
              text={storeItem.failureMessage ?? ""}
            />
          </ModalContent>
        </>
      )}
    </ModalWrapper>
  )
}

export default MultipleChoiceModalContent
