import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { TextField } from '@material-ui/core'
import ChooseExerciseItemType from './ChooseExerciseItemType'
import IFrameEditor from './IFrameEditor'
import { BlockEditProps } from '@wordpress/blocks'
import {v4} from 'uuid'
import { exercisesState } from '../../state/exercises'
import { useRecoilState } from 'recoil'

const ExerciseEditorCard = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
`

const ExerciseEditor = ({attributes, setAttributes }:BlockEditProps<{exercise_id: string}>) => {
  const [name, setName] = useState('')
  const [exercises, setExercises] = useRecoilState(exercisesState)

  useEffect(() => {
    if (attributes.exercise_id) {
      return
    }
    const id = v4()
    setAttributes({ exercise_id: id })
    setExercises((prev) => {
      const newPrev = {...prev}
      newPrev[id] =  { id: id, exercise_items: [  ], name: name }
      return newPrev
    })
  }, [])

  const [exerciseItems, setExerciseItems] = useState([])
  const onChooseExerciseItem = (selectedItem) => {
    setExerciseItems((prev) => [...prev, selectedItem])
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
      {exerciseItems.length === 0 && <ChooseExerciseItemType onChooseItem={onChooseExerciseItem} />}
      {exerciseItems.length !== 0 && <IFrameEditor exercise={exercises[attributes.exercise_id]} />}
    </ExerciseEditorCard>
  )
}

export default ExerciseEditor
