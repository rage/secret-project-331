import styled from '@emotion/styled'
import { faAngleDown, faAngleUp, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useState } from 'react'
import { QuizItemOption } from '../../../../../types/quizTypes'
import { primaryFont } from '../../../../shared-module/styles'
import MessageModel from '../common/MessageModal'

const OptionCard = styled.div`
  height: 50px;
  width: 100%;
  background-color: #F7F8F9;
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
`

const CorrectTag = styled.div`
  height: 24px;
  padding: 0 10px;
  background-color: #DAE6E5;
  font-size: 14px;
  border-radius: 26px;
  margin: 8px;
  font-weight: bold;
  align-self: center;
  color: #44827E;
  font-family: ${primaryFont};
`

const ExpandOptionButton = styled(FontAwesomeIcon)`
  background-color: #d3d7db;
  height: 16px;
  width: 16px;
  padding: 16px;
  cursor: pointer;
  color: #6D757B;
  :hover {
    background-color: #bcc0c4;
  }
`

const DeleteOptionButton = styled(FontAwesomeIcon)`
  height: 16px;
  width: 16px;
  padding: 16px;
  cursor: pointer;
  background-color: #C4C9CD;
  color: #333D45;
  :hover {
    background-color: #aaafb3;
  }
`
const MultipleChoiceMessageModalContainer = styled.div`
  margin-bottom: 4px;
`

interface MultipleChoiceOption {
  option: QuizItemOption
}

const MultipleChoiceOption: React.FC<MultipleChoiceOption> = ({ option }) => {
  const [visible, setVisible] = useState(true)

  const handleClick = () => {
    setVisible(!visible)
  }

  return (
    <>
      <OptionCard>
        <ChoiceTitle>
          { option.title }
        </ChoiceTitle>

        <OptionButtonGroup>
          {
            option.correct && <CorrectTag> correct </CorrectTag>
          }
          <ExpandOptionButton onClick={handleClick} icon={visible ? faAngleDown : faAngleUp}/>
          <DeleteOptionButton icon={faX}/>
        </OptionButtonGroup>
      </OptionCard>
      { !visible &&
        <MultipleChoiceMessageModalContainer>
          <MessageModel title={"Success message"} description={option.messageAfterSubmissionWhenSelected ?? ""}/>
        </MultipleChoiceMessageModalContainer>
      }
    </>

  )
}
export default MultipleChoiceOption
