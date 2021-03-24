import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { TextField } from '@material-ui/core'
import ChooseExerciseItemType from './ChooseExerciseItemType'
import IFrameEditor from './IFrameEditor'
import { BlockEditProps } from '@wordpress/blocks'
import { v4 } from 'uuid'
import { exerciseFamilySelector } from '../../state/exercises'
import { useRecoilState } from 'recoil'
import {
  ExerciseWithExerciseItems,
  PageUpdateExercise,
  PageUpdateExerciseItem,
} from '../../services/services.types'
import { ExerciseAttributes } from '.'
import { exerciseItemTypes } from './ChooseExerciseItemType/ExerciseServiceList'

const ExerciseEditorCard = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
`

const ExerciseEditor = ({ attributes }: BlockEditProps<ExerciseAttributes>) => {
  const [exercise, setExercise] = useRecoilState(exerciseFamilySelector(attributes.exercise_id))

  const onChooseExerciseType = (selectedItem: any) => {
    setExercise((prev) => {
      const newItem: PageUpdateExerciseItem = {
        id: v4(),
        exercise_type: selectedItem.identifier,
        assignment: [],
        spec: null,
      }
      return { ...prev, exercise_items: [...prev.exercise_items, newItem] }
    })
  }

  useEffect(() => {
    if (exercise) {
      return
    }
    setExercise({ id: attributes.exercise_id, exercise_items: [], name: '' })
  }, [exercise])

  if (!exercise) {
    return null
  }
  const exerciseChosen = exercise.exercise_items.length > 0

  return (
    <ExerciseEditorCard>
      <div>Exercise editor</div>
      <TextField
        fullWidth
        variant="outlined"
        value={exercise.name}
        onChange={(e) =>
          setExercise((prev) => {
            return { ...prev, name: e.target.value }
          })
        }
      />
      {!exerciseChosen && <ChooseExerciseItemType onChooseItem={onChooseExerciseType} />}
      {exerciseChosen &&
        exercise.exercise_items.map((ei) => {
          const url = exerciseItemTypes.find((o) => o.identifier === ei.exercise_type)?.url
          return <IFrameEditor exercise={ei} url={url} />
        })}
    </ExerciseEditorCard>
  )
}

export default ExerciseEditor
