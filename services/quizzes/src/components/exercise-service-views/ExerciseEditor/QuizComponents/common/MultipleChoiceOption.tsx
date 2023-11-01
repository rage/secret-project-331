import styled from "@emotion/styled"
import { faAngleDown, faAngleUp, faCheck, faPen, faX } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import { QuizItemOption } from "../../../../../../types/quizTypes/privateSpec"
import CheckBox from "../../../../../shared-module/components/InputFields/CheckBox"
import TextField from "../../../../../shared-module/components/InputFields/TextField"
import { baseTheme, primaryFont } from "../../../../../shared-module/styles"
import { nullIfEmptyString } from "../../../../../shared-module/utils/strings"

const OptionCard = styled.div`
  height: 50px;
  width: 100%;
  background-color: #f7f8f9;
  display: flex;
  align-items: center;
`

const OptionButtonGroup = styled.div`
  display: flex;
  margin-left: auto;
`

const ChoiceTitle = styled.div`
  font-size: 20px;
  margin-left: 16px;
  font-family: ${primaryFont};
  max-width: 550ch;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`

const CorrectTag = styled.div`
  height: 24px;
  padding: 0 10px;
  background-color: #dae6e5;
  font-size: 14px;
  border-radius: 26px;
  margin: 8px;
  font-weight: bold;
  align-self: center;
  color: #44827e;
  font-family: ${primaryFont};
`

const ExpandOptionButton = styled(FontAwesomeIcon)`
  background-color: #d3d7db;
  height: 16px;
  width: 16px;
  padding: 16px;
  cursor: pointer;
  color: #6d757b;
  :hover {
    background-color: #bcc0c4;
  }
`

const EditOptionButton = styled(FontAwesomeIcon)`
  opacity: 0.7;
  height: 16px;
  width: 16px;
  padding: 16px;
  cursor: pointer;
  color: #6d757b;
  :hover {
    opacity: 1;
  }
`

const CenteredContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 16px;
  margin-left: 6px;
`

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
`

const MessageDialogContainer = styled.div`
  display: flex;
  flex-direction: column;
  background-color: #f7f8f9;
  margin-bottom: 3px;
`

const MessageDialogTextFieldContainer = styled.div`
  margin: 4px;
  color: #535a66;
  height: 60px;
`

const MessageDialogTitle = styled.div`
  background-color: #dae6e5;
  color: #44827e;
  font-size: 17px;
  font-weight: bold;
  width: 100%;
  height: 40px;
  padding: 8px 0px 0px 16px;
`

const MessageDialogDescription = styled.div<{ isNull: boolean }>`
  color: #535a66;
  padding: 16px;
  height: 60px;
  color: ${(props) => (props.isNull ? baseTheme.colors.gray[500] : baseTheme.colors.gray[600])};
`

const DeleteOptionButton = styled(FontAwesomeIcon)`
  height: 16px;
  width: 16px;
  padding: 16px;
  cursor: pointer;
  background-color: #c4c9cd;
  color: #333d45;
  :hover {
    background-color: #aaafb3;
  }
`
const MultipleChoiceMessageDialogContainer = styled.div`
  margin-bottom: 4px;
`

interface MultipleChoiceOption {
  option: QuizItemOption
  onUpdateValues: (
    title: string | null,
    messageAfterSubmissionWhenThisOptionSelected: string | null,
    messageOnModelSolutionWhenThisOptionSelected: string | null,
    correct: boolean,
  ) => void
  onDelete: () => void
}

const MultipleChoiceOption: React.FC<MultipleChoiceOption> = ({
  option,
  onUpdateValues,
  onDelete,
}) => {
  const [visible, setVisible] = useState(true)
  const [editMode, setEditMode] = useState(false)

  const [title, setTitle] = useState(option.title)
  const [
    messageAfterSubmissionWhenThisOptionSelected,
    setMessageAfterSubmissionWhenThisOptionSelected,
  ] = useState<string | null>(option.messageAfterSubmissionWhenSelected)
  const [
    messageOnModelSolutionWhenThisOptionSelected,
    setMessageOnModelSolutionWhenThisOptionSelected,
  ] = useState<string | null>(option.additionalCorrectnessExplanationOnModelSolution)
  const [correct, setCorrect] = useState(option.correct)

  const { t } = useTranslation()

  const handleVisibility = useCallback(() => {
    setVisible(!visible)
  }, [visible])

  const toggleEditMode = useCallback(() => {
    setEditMode(!editMode)
  }, [editMode])

  const startEditMode = useCallback(() => {
    setMessageAfterSubmissionWhenThisOptionSelected(option.messageAfterSubmissionWhenSelected ?? "")
    setTitle(option.title)
    setCorrect(option.correct)
    toggleEditMode()
  }, [option.correct, option.messageAfterSubmissionWhenSelected, option.title, toggleEditMode])

  const saveChanges = useCallback(() => {
    onUpdateValues(
      title,
      messageAfterSubmissionWhenThisOptionSelected,
      messageOnModelSolutionWhenThisOptionSelected,
      correct,
    )
    toggleEditMode()
  }, [
    correct,
    messageAfterSubmissionWhenThisOptionSelected,
    messageOnModelSolutionWhenThisOptionSelected,
    onUpdateValues,
    title,
    toggleEditMode,
  ])

  return (
    <>
      <OptionCard>
        {editMode ? (
          <CenteredContainer>
            <TextField onChangeByValue={(value) => setTitle(value)} value={title ?? undefined} />
            <CheckboxContainer>
              <CheckBox
                label={t("label-correct")}
                onChangeByValue={(checked) => setCorrect(checked)}
                checked={correct}
              />
            </CheckboxContainer>
          </CenteredContainer>
        ) : (
          <>
            <ChoiceTitle>{option.title}</ChoiceTitle>
          </>
        )}
        <OptionButtonGroup>
          {option.correct && !editMode && <CorrectTag> {t("label-correct")} </CorrectTag>}
          {editMode ? (
            <EditOptionButton onClick={saveChanges} icon={faCheck} />
          ) : (
            <EditOptionButton onClick={startEditMode} icon={faPen} />
          )}
          <ExpandOptionButton onClick={handleVisibility} icon={visible ? faAngleDown : faAngleUp} />
          <DeleteOptionButton onClick={onDelete} icon={faX} />
        </OptionButtonGroup>
      </OptionCard>
      {!visible && (
        <>
          {!editMode ? (
            <MultipleChoiceMessageDialogContainer>
              <MessageDialogContainer>
                <MessageDialogTitle>
                  {t("message-after-submission-when-this-option-selected")}
                </MessageDialogTitle>
                <MessageDialogDescription
                  isNull={option.messageAfterSubmissionWhenSelected === null}
                >
                  {option.messageAfterSubmissionWhenSelected ?? `(${t("label-null")})`}
                </MessageDialogDescription>
              </MessageDialogContainer>
              <MessageDialogContainer>
                <MessageDialogTitle>
                  {t("message-on-model-solution-when-this-option-selected")}
                </MessageDialogTitle>
                <MessageDialogDescription
                  isNull={option.additionalCorrectnessExplanationOnModelSolution === null}
                >
                  {option.additionalCorrectnessExplanationOnModelSolution ?? `(${t("label-null")})`}
                </MessageDialogDescription>
              </MessageDialogContainer>
            </MultipleChoiceMessageDialogContainer>
          ) : (
            <MultipleChoiceMessageDialogContainer>
              <MessageDialogContainer>
                <MessageDialogTitle>
                  {t("message-after-submission-when-this-option-selected")}
                </MessageDialogTitle>
                <MessageDialogTextFieldContainer>
                  <TextField
                    onChange={(event) =>
                      setMessageAfterSubmissionWhenThisOptionSelected(
                        nullIfEmptyString(event.target.value),
                      )
                    }
                    value={messageAfterSubmissionWhenThisOptionSelected ?? undefined}
                  />
                </MessageDialogTextFieldContainer>
              </MessageDialogContainer>
              <MessageDialogContainer>
                <MessageDialogTitle>
                  {t("message-on-model-solution-when-this-option-selected")}
                </MessageDialogTitle>
                <MessageDialogTextFieldContainer>
                  <TextField
                    onChange={(event) =>
                      setMessageOnModelSolutionWhenThisOptionSelected(
                        nullIfEmptyString(event.target.value),
                      )
                    }
                    value={messageOnModelSolutionWhenThisOptionSelected ?? undefined}
                  />
                </MessageDialogTextFieldContainer>
              </MessageDialogContainer>
            </MultipleChoiceMessageDialogContainer>
          )}
        </>
      )}
    </>
  )
}
export default MultipleChoiceOption
