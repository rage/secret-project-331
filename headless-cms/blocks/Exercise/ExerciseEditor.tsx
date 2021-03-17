import { Card } from '@material-ui/core'
import { useState } from 'react'
import styled from 'styled-components'
import { TextField } from '@material-ui/core'
import ChooseExerciseItemType from './ChooseExerciseItemType'

const ExerciseEditorCard = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
`

const ExerciseEditor = () => {
  const [name, setName] = useState('')
  const [exerciseItems, setExerciseItems] = useState([])
  const onChooseExerciseItem = () => {}
  return (
    <ExerciseEditorCard>
      <div>Exercise editor</div>
      <TextField
        fullWidth
        variant="outlined"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {exerciseItems.length === 0 && <ChooseExerciseItemType />}
    </ExerciseEditorCard>
  )
}

export default ExerciseEditor
