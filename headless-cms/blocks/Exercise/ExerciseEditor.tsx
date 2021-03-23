import { useState } from 'react'
import styled from 'styled-components'
import { TextField } from '@material-ui/core'
import ChooseExerciseItemType from './ChooseExerciseItemType'
import IFrameEditor from './IFrameEditor'
import { BlockEditProps } from '@wordpress/blocks'
import { v4 } from 'uuid'
import { exerciseFamilySelector } from '../../state/exercises'
import { useRecoilState } from 'recoil'
import { ExerciseAttributes } from '../blocks.types'

const ExerciseEditorCard = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
`

const ExerciseEditor = ({ setAttributes, clientId }: BlockEditProps<ExerciseAttributes>) => {
  const [name, setName] = useState('')
  const [exercises, setExercises] = useRecoilState(exerciseFamilySelector(clientId))
  const [exerciseChosen, setExerciseChosen] = useState(false)

  const addNewExercise = (selectedItem) => {
    const id = v4()
    setAttributes({ exercise_id: id })
    setExercises({ id: id, exercise_items: [], name: selectedItem.name, url: selectedItem.url })
  }

  const onChooseExerciseType = (selectedItem) => {
    addNewExercise(selectedItem)
    setExerciseChosen(true)
  }

  return (
    <ExerciseEditorCard>
      <div>Exercise editor</div>
      <TextField
        fullWidth
        variant="outlined"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {!exerciseChosen && <ChooseExerciseItemType onChooseItem={onChooseExerciseType} />}
      {exerciseChosen && <IFrameEditor exercise={exercises} />}
    </ExerciseEditorCard>
  )
}

export default ExerciseEditor
