import styled from "@emotion/styled"
import { faAngleDown, faAngleUp, faX } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { QuizItemOption } from "../../../../../types/quizTypes"
import { primaryFont } from "../../../../shared-module/styles"
import MessageDialog from "../common/MessageDialog"

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
  onDelete: () => void
}

const MultipleChoiceOption: React.FC<MultipleChoiceOption> = ({ option, onDelete }) => {
  const [visible, setVisible] = useState(true)

  const { t } = useTranslation()

  const handleClick = () => {
    setVisible(!visible)
  }

  return (
    <>
      <OptionCard>
        <ChoiceTitle
          contentEditable={true}
          suppressContentEditableWarning={true}
          onInput={() => {
            // onTitleChange(event.target.innerText)
          }}
        >
          {option.title}
        </ChoiceTitle>

        <OptionButtonGroup>
          {option.correct && <CorrectTag> {t("label-correct")} </CorrectTag>}
          <ExpandOptionButton onClick={handleClick} icon={visible ? faAngleDown : faAngleUp} />
          <DeleteOptionButton onClick={onDelete} icon={faX} />
        </OptionButtonGroup>
      </OptionCard>
      {!visible && (
        <MultipleChoiceMessageDialogContainer>
          <MessageDialog
            title={t("success-message")}
            description={option.messageAfterSubmissionWhenSelected ?? ""}
          />
        </MultipleChoiceMessageDialogContainer>
      )}
    </>
  )
}
export default MultipleChoiceOption
