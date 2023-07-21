import { css } from "@emotion/css"
import styled from "@emotion/styled"
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
  Radio,
  RadioGroup,
  Switch,
} from "@mui/material"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import {
  multipleChoiceMultipleOptionsGradingPolicy,
  NormalizedQuizItem,
} from "../../../../../types/types"
import SelectField from "../../../../shared-module/components/InputFields/SelectField"
import { createdNewOption } from "../../../../store/editor/editorActions"
import {
  editedItemDirection,
  editedItemFailureMessage,
  editedItemSuccessMessage,
  editedMultipleChoiceMultipleOptionsGradingPolicy,
  editedQuizItemTitle,
  editedSharedOptionsFeedbackMessage,
  toggledAllAnswersCorrect,
  toggledMultiOptions,
  toggledSharedOptionFeedbackMessage,
  toggledShuffleOptions,
} from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import MarkdownEditor from "../../../MarkdownEditor"
import { ModalWrapper } from "../../../Shared/Modal"

import MultipleChoiceButton from "./MultipleChoiceButton"

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

/* eslint-disable i18next/no-literal-string */
const stringToMultipleChoiceMultipleOptionsGradingPolicy = (
  content: string,
): multipleChoiceMultipleOptionsGradingPolicy => {
  switch (content) {
    case "default":
      return "default"
    case "points-off-incorrect-options":
      return "points-off-incorrect-options"
    case "points-off-unselected-options":
      return "points-off-unselected-options"
  }
  return "default"
}

export const MultipleChoiceModalContent: React.FC<React.PropsWithChildren<EditorModalProps>> = ({
  item,
}) => {
  const { t } = useTranslation()
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const storeOptions = useTypedSelector((state) => state.editor.options)
  const dispatch = useDispatch()

  const multipleChoiceOptions = [
    {
      value: "default",
      label: t("multiple-choice-grading-default"),
    },
    {
      value: "points-off-incorrect-options",
      label: t("multiple-choice-grading-points-off-incorrect-options"),
    },
    {
      value: "points-off-unselected-options",
      label: t("multiple-choice-grading-points-off-unselected-options"),
    },
  ]

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
            label={t("shuffled-checkbox-message")}
            labelPlacement="start"
            control={
              <Checkbox
                color="primary"
                checked={storeItem.shuffleOptions}
                onChange={(event) =>
                  dispatch(toggledShuffleOptions(storeItem.id, event.target.checked))
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
      <div>
        <SelectField
          id={"multiple-choice-grading"}
          className={css`
            width: 100%;
            margin-bottom: 0.3rem;
          `}
          disabled={!storeItem.multi}
          onChangeByValue={(value) =>
            dispatch(
              editedMultipleChoiceMultipleOptionsGradingPolicy(
                storeItem.id,
                stringToMultipleChoiceMultipleOptionsGradingPolicy(value),
              ),
            )
          }
          defaultValue={storeItem.multipleChoiceMultipleOptionsGradingPolicy}
          label={t("multiple-choice-grading")}
          options={multipleChoiceOptions}
        />
        <span
          className={css`
            color: #414246;
            font-size: 17px;
            font-family: Josefin Sans, sans-serif;
            ${!storeItem.multi && "opacity: 0.5;"}
          `}
        >
          {storeItem.multipleChoiceMultipleOptionsGradingPolicy == "default" &&
            t("multiple-choice-grading-default-description")}
          {storeItem.multipleChoiceMultipleOptionsGradingPolicy == "points-off-incorrect-options" &&
            t("multiple-choice-grading-points-off-incorrect-options-description")}
          {storeItem.multipleChoiceMultipleOptionsGradingPolicy ==
            "points-off-unselected-options" &&
            t("multiple-choice-grading-points-off-unselected-options-description")}
        </span>
      </div>

      <ModalContent>
        <MarkdownEditor
          label={t("title")}
          onChange={(value) => dispatch(editedQuizItemTitle(value, storeItem.id))}
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
              label={t("give-full-points-even-if-answer-incorrect")}
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
            onChange={(value) => dispatch(editedSharedOptionsFeedbackMessage(storeItem.id, value))}
            text={storeItem.sharedOptionFeedbackMessage ?? ""}
          />
        </ModalContent>
      ) : (
        <>
          <ModalContent>
            <MarkdownEditor
              label={t("success-message")}
              onChange={(value) => dispatch(editedItemSuccessMessage(storeItem.id, value))}
              text={storeItem.successMessage ?? ""}
            />
          </ModalContent>
          <ModalContent>
            <MarkdownEditor
              label={t("failure-message")}
              onChange={(value) => dispatch(editedItemFailureMessage(storeItem.id, value))}
              text={storeItem.failureMessage ?? ""}
            />
          </ModalContent>
        </>
      )}
    </ModalWrapper>
  )
}

export default MultipleChoiceModalContent
