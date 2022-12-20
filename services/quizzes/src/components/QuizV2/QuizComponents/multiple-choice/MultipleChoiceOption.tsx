import styled from "@emotion/styled"
import { faAngleDown, faAngleUp, faCheck, faPen, faX } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { QuizItemOption } from "../../../../../types/quizTypes"
import CheckBox from "../../../../shared-module/components/InputFields/CheckBox"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import { primaryFont } from "../../../../shared-module/styles"

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
  opacity: 0.3;
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
  onSuccessMessageChange: (value: string) => void
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
  const [message, setMessage] = useState(option.messageAfterSubmissionWhenSelected ?? "")
  const [correct, setCorrect] = useState(option.correct)

  const { t } = useTranslation()

  const handleVisibility = () => {
    setVisible(!visible)
  }

  const toggleEditMode = () => {
    setEditMode(!editMode)
  }

  const startEditMode = () => {
    setMessage(option.messageAfterSubmissionWhenSelected ?? "")
    setTitle(option.title)
    setCorrect(option.correct)
    toggleEditMode()
  }

  const saveChanges = () => {
    onUpdateValues(title, message, correct)
    toggleEditMode()
  }

  return (
    <>
      <OptionCard>
        {editMode ? (
          <CenteredContainer>
            <TextField onChange={(value) => setTitle(value)} value={title} />
            <CheckboxContainer>
              <CheckBox
                label={t("label-correct")}
                onChange={(checked) => setCorrect(checked)}
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
          {editMode ? (
            <EditOptionButton onClick={saveChanges} icon={faCheck} />
          ) : (
            <EditOptionButton onClick={startEditMode} icon={faPen} />
          )}
          {option.correct && !editMode && <CorrectTag> {t("label-correct")} </CorrectTag>}
          <ExpandOptionButton onClick={handleVisibility} icon={visible ? faAngleDown : faAngleUp} />
          <DeleteOptionButton onClick={onDelete} icon={faX} />
        </OptionButtonGroup>
      </OptionCard>
      {!visible && (
        <>
          {!editMode ? (
            <MultipleChoiceMessageDialogContainer>
              <MessageDialogContainer>
                <MessageDialogTitle>{t("success-message")}</MessageDialogTitle>
                <MessageDialogDescription>
                  {option.messageAfterSubmissionWhenSelected}
                </MessageDialogDescription>
              </MessageDialogContainer>
            </MultipleChoiceMessageDialogContainer>
          ) : (
            <MultipleChoiceMessageDialogContainer>
              <MessageDialogContainer>
                <MessageDialogTitle>{t("success-message")}</MessageDialogTitle>
                <MessageDialogTextFieldContainer>
                  <TextField onChange={(value) => setMessage(value)} value={message} />
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
