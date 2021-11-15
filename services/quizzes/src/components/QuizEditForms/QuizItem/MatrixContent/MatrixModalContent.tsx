import {
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
  TextField,
} from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { NormalizedQuizItem } from "../../../../../types/types"
import {
  setMatrixColumnSize,
  setMatrixRowSize,
} from "../../../../store/editor/itemVariables/itemVariableActions"
import {
  editedItemDirection,
  editedItemFailureMessage,
  editedItemSuccessMessage,
  editedMatrixColumnSize,
  editedMatrixRowSize,
  editedQuizItemFeedbackDisplayPolicy,
  editedQuizItemTitle,
  editedSharedOptionsFeedbackMessage,
  toggledAllAnswersCorrect,
  toggledMultiOptions,
  toggledSharedOptionFeedbackMessage,
} from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import MarkdownEditor from "../../../MarkdownEditor"
import { ModalWrapper } from "../../../Shared/Modal"

import MatrixButton from "./MatrixChoiceButton"

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

const ValueFieldContainer = styled(TextField)`
  margin-left: 0.5rem !important;
`

interface EditorModalProps {
  item: NormalizedQuizItem
}

export const MatrixModalContent: React.FC<EditorModalProps> = ({ item }) => {
  const { t } = useTranslation()
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const storeOptions = useTypedSelector((state) => state.editor.options)
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])
  const dispatch = useDispatch()

  const handleColumnValueChange = (value: number) => {
    if (value >= 0 && value < 11) {
      dispatch(setMatrixColumnSize(storeItem.id, value, true))
      dispatch(editedMatrixColumnSize(storeItem.id, value))
    } else {
      dispatch(setMatrixColumnSize(storeItem.id, value, false))
    }
  }

  const handleRowValueChange = (value: number) => {
    if (value >= 0 && value < 11) {
      dispatch(setMatrixRowSize(storeItem.id, value, true))
      dispatch(editedMatrixRowSize(storeItem.id, value))
    } else {
      dispatch(setMatrixRowSize(storeItem.id, value, false))
    }
  }

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
      <ModalContentTitleWrapper>
        <h4>{t("matrix-size")}</h4>
      </ModalContentTitleWrapper>
      <ModalContent>
        <ValueFieldContainer
          error={!variables.validMin}
          helperText={!variables.validMin ? t("invalid-minimum-value") : ""}
          type="number"
          label={t("matrix-size-column")}
          value={variables.columns ?? ""}
          fullWidth
          variant="outlined"
          onChange={(event) => handleColumnValueChange(Number(event.target.value))}
        />
      </ModalContent>
      <ModalContent>
        <ValueFieldContainer
          error={!variables.validMin}
          helperText={!variables.validMin ? t("invalid-minimum-value") : ""}
          type="number"
          label={t("matrix-size-row")}
          value={variables.rows ?? ""}
          fullWidth
          variant="outlined"
          onChange={(event) => handleRowValueChange(Number(event.target.value))}
        />
      </ModalContent>
      <ModalContentOptionWrapper>
        {storeItem.options.map((option, i) => (
          <ModalContent key={option}>
            <MatrixButton index={i + 1} option={storeOptions[option]} />
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

export default MatrixModalContent
