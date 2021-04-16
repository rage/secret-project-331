import { useEffect, useState } from "react"
import styled from "@emotion/styled"
import { TextField } from "@material-ui/core"
import ChooseExerciseItemType from "./ChooseExerciseItemType"
import IFrameEditor from "./IFrameEditor"
import { BlockEditProps } from "@wordpress/blocks"
import { v4 } from "uuid"
import { exerciseFamilySelector } from "../../state/exercises"
import { useRecoilState } from "recoil"
import { ExerciseItem, PageUpdateExerciseItem } from "../../services/services.types"
import { ExerciseItemAttributes } from "."
import { exerciseItemTypes } from "./ChooseExerciseItemType/ExerciseServiceList"
import { InnerBlocks } from "@wordpress/block-editor"

const ExerciseItemEditorCard = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
`

const Title = styled.h1`
  font-size: 24px;
`

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph", "core/list"]

const ExerciseItemEditor: React.FC<BlockEditProps<ExerciseItemAttributes>> = (props) => {
  // const [exercise, setExercise] = useRecoilState(exerciseFamilySelector(attributes.exercise_id))
  const { attributes, setAttributes } = props
  const [exerciseItem, setExerciseItem] = useState<undefined | PageUpdateExerciseItem | ExerciseItem>(undefined)

  const onChooseExerciseType = (selectedItem: any) => {
    setExerciseItem({
        id: v4(),
        exercise_type: selectedItem.identifier,
        assignment: [],
        spec: null,
      })
  }

  const url = exerciseItemTypes.find((o) => o.identifier === exerciseItem?.exercise_type)?.url
  const id = attributes.exercise_item_id
  return (
    <ExerciseItemEditorCard id={attributes.exercise_item_id}>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      {!exerciseItem && <ChooseExerciseItemType onChooseItem={onChooseExerciseType} />}
      {exerciseItem && <IFrameEditor key={id} exerciseItemid={id} url={url} props={props} />}
    </ExerciseItemEditorCard>
  )
}

export default ExerciseItemEditor
