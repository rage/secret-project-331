import styled from '@emotion/styled'
import React from 'react'
import { PrivateSpecQuizItemMultiplechoice } from '../../../../../types/quizTypes'
import TextField from '../../../../shared-module/components/InputFields/TextField'
import EditorCard from '../common/EditorCard'
import { primaryFont } from '../../../../shared-module/styles'
import MultipleChoiceOption from './MultipleChoiceOption'
import Button from '../../../../shared-module/components/Button'
import CheckBox from '../../../../shared-module/components/InputFields/CheckBox'
import ToggleCard from '../common/ToggleCard'
import Accordion from '../../../../shared-module/components/Accordion'
import RadioButton from '../../../../shared-module/components/InputFields/RadioButton'

interface MultipleChoiceEditorProps {
  quizItem: PrivateSpecQuizItemMultiplechoice
}

const OptionTitle = styled.div`
  font-size: 20px;
  font-family: ${primaryFont};
  font-weight: bold;
`

const OptionDescription = styled.div`
  font-size: 17px;
  color: #b3b3b3;
  margin-bottom: 12px;
`

const OptionCardContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const OptionNameContainer = styled.div`
  width: 80vh;
  display: inline;
  position: relative;
  top: -10px;

`
const OptionCheckBoxContainer = styled.div`
  width: 15vh;
  display: inline;
  margin-left: 20px;

`

const OptionCreationWrapper = styled.div`
  /* Remove margin from input */
  * {
    margin: 0px;
  }
  display: flex;
  flex-direction: row;
  gap: 16px;
  align-items: center;
  background-color: #E8E8E8;
  margin-bottom: 8px;
  height: 45px;
  margin-top: 16px;
`

const OptionCreationContainer = styled.div`
  background-color: #FBFBFB;
  border: 1px solid #e2e4e6;
  width: 100%;
  margin-top: 28px;
  padding: 20px;
`

const AdvancedOptionsContainer = styled.div`
  padding: 8px;
`

const MultipleChoiceLayoutChoiceContainer = styled.div`
  display: flex;
  flex-direction: row;
  /* Remove margin from the RadioButtons*/
  * {
    margin: 0px;
  }
  padding: 2px;
  gap: 16px;
  margin-bottom: 16px;
`


const MultipleChoiceEditor: React.FC<MultipleChoiceEditorProps> = ({ quizItem }) => {
  return (
    <EditorCard title={"MULTIPLE-CHOICE"}>
      <TextField value={quizItem.title} label={"Title"} name={"title"}/>
      <OptionTitle> Options </OptionTitle>
      <OptionDescription>
        Add multiple options to this question
      </OptionDescription>
      <OptionCardContainer>
        { quizItem.options.map(option => (
          <MultipleChoiceOption option={option}/>
        ))}
      </OptionCardContainer>

      <OptionCreationContainer>
          <OptionCreationWrapper>
            <OptionNameContainer>
              <TextField label={"Option name"} placeholder={"Option name"}/>
            </OptionNameContainer>
            <OptionCheckBoxContainer>
              <CheckBox label={"Correct"}/>
            </OptionCheckBoxContainer>
          </OptionCreationWrapper>

          <TextField label={"Success message"} placeholder={"Success message"}/>
          <Button variant="primary" size={'medium'}>
            Add options
          </Button>
      </OptionCreationContainer>

      {/* Advanced options */}
      <br/>
      <Accordion  variant='detail' title='Advanced options'>
        <details>
          <summary>Advanced options </summary>
          <AdvancedOptionsContainer>
            <OptionTitle> Layout options </OptionTitle>
            <OptionDescription>
              Choose the direction the quiz item options will be used to lay out in widget
            </OptionDescription>
            <MultipleChoiceLayoutChoiceContainer
              role="radiogroup"
            >
                  <RadioButton checked={quizItem.direction == 'row'} label='Row'/>
                  <RadioButton checked={quizItem.direction == 'column'} label='Column'/>
            </MultipleChoiceLayoutChoiceContainer>
            <OptionTitle> Answering options </OptionTitle>
            <ToggleCard title={"Allow selecting multiple options"} description={"All answers correct (no matter what one answers is correct)"} state={quizItem.allowSelectingMultipleOptions}/>
            <ToggleCard title={"No wrong answers"} description={"All answers correct (no matter what one asnwers it is correct)"} state={quizItem.allowSelectingMultipleOptions}/>
            <ToggleCard title={"Shuffle options"} description={"Present choices in random order"} state={quizItem.shuffleOptions}/>
            <OptionTitle> Feedback message </OptionTitle>
            <TextField label={"Success message"}/>
            <TextField label={"Failure message"}/>

          </AdvancedOptionsContainer>
        </details>
      </Accordion>
    </EditorCard>
  )
}

export default MultipleChoiceEditor
