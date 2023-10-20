import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { CheckCircle, Pencil, XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { QuizItemOption } from "../../../../../../types/quizTypes/privateSpec"
import Button from "../../../../../shared-module/components/Button"
import CheckBox from "../../../../../shared-module/components/InputFields/CheckBox"
import TextField from "../../../../../shared-module/components/InputFields/TextField"
import ArrowDown from "../../../../../shared-module/img/caret-arrow-down.svg"
import ArrowUp from "../../../../../shared-module/img/caret-arrow-up.svg"
import { primaryFont } from "../../../../../shared-module/styles"

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

const MessageDialogDescription = styled.div`
  color: #535a66;
  padding: 16px;
  height: 60px;
`
const MultipleChoiceMessageDialogContainer = styled.div`
  margin-bottom: 4px;
`

interface MultipleChoiceOption {
  option: QuizItemOption
  onMessageAfterSubmissionWhenSelectedChange: (value: string) => void
  onTitleChange: (value: string) => void
  onUpdateValues: (title: string, message: string, correct: boolean) => void
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
  const [messageAfterSubmissionWhenSelected, setMessageAfterSubmissionWhenSelected] = useState(
    option.messageAfterSubmissionWhenSelected ?? "",
  )
  const [correct, setCorrect] = useState(option.correct)

  const { t } = useTranslation()

  const handleVisibility = () => {
    setVisible(!visible)
  }

  const toggleEditMode = () => {
    setEditMode(!editMode)
  }

  const startEditMode = () => {
    setMessageAfterSubmissionWhenSelected(option.messageAfterSubmissionWhenSelected ?? "")
    setTitle(option.title)
    setCorrect(option.correct)
    toggleEditMode()
  }

  const saveChanges = () => {
    onUpdateValues(title, messageAfterSubmissionWhenSelected, correct)
    toggleEditMode()
  }

  return (
    <>
      <OptionCard>
        {editMode ? (
          <CenteredContainer>
            <TextField onChangeByValue={(value) => setTitle(value)} value={title} />
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
            <Button
              className={css`
                padding: 16px !important;
              `}
              variant="icon"
              size="small"
              onClick={saveChanges}
            >
              <CheckCircle
                size={16}
                className={css`
                  color: #6d757b;
                  :hover {
                    opacity: 1;
                  }
                `}
              />
            </Button>
          ) : (
            <Button
              className={css`
                display: flex;
                align-items: center;
                justify-content: center;
                height: 50px;
                width: 48px;
              `}
              variant="icon"
              size="small"
              onClick={startEditMode}
            >
              <Pencil
                className={css`
                  opacity: 0.9;
                  cursor: pointer;
                  color: #6d757b;
                  :hover {
                    opacity: 1;
                  }
                `}
                size={16}
              />
            </Button>
          )}
          <Button
            className={css`
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: #d3d7db !important;
              height: 50px;
              width: 48px;
              cursor: pointer;
              color: #6d757b;
              :hover {
                background-color: #bcc0c4;
              }
            `}
            variant="icon"
            size="small"
            onClick={handleVisibility}
          >
            {visible ? (
              <ArrowDown
                className={css`
                  margin-bottom: 4px;
                  transform: scale(1.4);
                `}
              />
            ) : (
              <ArrowUp
                className={css`
                  margin-bottom: 4px;
                  transform: scale(1.4);
                `}
              />
            )}
          </Button>
          <Button
            className={css`
              height: 50px;
              width: 48px;
              cursor: pointer;
              background-color: #c4c9cd !important;
              :hover {
                background-color: #aaafb3 !important;
              }
            `}
            variant="icon"
            size="small"
            onClick={onDelete}
          >
            <XmarkCircle size={16} color="#333d45" />
          </Button>
        </OptionButtonGroup>
      </OptionCard>
      {!visible && (
        <>
          {!editMode ? (
            <MultipleChoiceMessageDialogContainer>
              <MessageDialogContainer>
                <MessageDialogTitle>
                  {t("message-after-submission-when-selected")}
                </MessageDialogTitle>
                <MessageDialogDescription>
                  {option.messageAfterSubmissionWhenSelected}
                </MessageDialogDescription>
              </MessageDialogContainer>
            </MultipleChoiceMessageDialogContainer>
          ) : (
            <MultipleChoiceMessageDialogContainer>
              <MessageDialogContainer>
                <MessageDialogTitle>
                  {t("message-after-submission-when-selected")}
                </MessageDialogTitle>
                <MessageDialogTextFieldContainer>
                  <TextField
                    onChangeByValue={(value) => setMessageAfterSubmissionWhenSelected(value)}
                    value={messageAfterSubmissionWhenSelected}
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
