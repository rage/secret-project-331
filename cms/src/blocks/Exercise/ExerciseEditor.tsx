import { useEffect } from "react"
import styled from "styled-components"
import { TextField } from "@material-ui/core"
import ChooseExerciseItemType from "./ChooseExerciseItemType"
import IFrameEditor from "./IFrameEditor"
import { BlockEditProps } from "@wordpress/blocks"
import { v4 } from "uuid"
import { exerciseFamilySelector } from "../../state/exercises"
import { useRecoilState } from "recoil"
import { ExerciseItem, PageUpdateExerciseItem } from "../../services/services.types"
import { ExerciseAttributes } from "."
import { exerciseItemTypes } from "./ChooseExerciseItemType/ExerciseServiceList"

const ExerciseEditorCard = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
`

const Title = styled.h1`
  font-size: 24px;
`

const ExerciseEditor: React.FC<BlockEditProps<ExerciseAttributes>> = ({ attributes }) => {
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
    setExercise({ id: attributes.exercise_id, exercise_items: [], name: "" })
  }, [exercise])

  if (!exercise) {
    return null
  }
  const exerciseChosen = exercise.exercise_items.length > 0

  return (
    <ExerciseEditorCard id={exercise.id}>
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
      {exerciseChosen && (
        <>
          <Title>{exercise.name}</Title>
          {exercise.exercise_items.map((ei: ExerciseItem | PageUpdateExerciseItem) => {
            const url = exerciseItemTypes.find((o) => o.identifier === ei.exercise_type)?.url
            return (
              <IFrameEditor key={ei.id} parentId={exercise.id} exerciseItemid={ei.id} url={url} />
            )
          })}
        </>
      )}
    </ExerciseEditorCard>
  )
}

export default ExerciseEditor
