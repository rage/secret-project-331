import { useState } from "react"
import styled from "@emotion/styled"
import ChooseExerciseItemType from "./ChooseExerciseItemType"
import IFrameEditor from "./IFrameEditor"
import { BlockEditProps } from "@wordpress/blocks"
import { ExerciseItemAttributes } from "."
import { exerciseItemTypes } from "./ChooseExerciseItemType/ExerciseServiceList"
import { InnerBlocks } from "@wordpress/block-editor"

const ExerciseItemEditorCard = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
`

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph", "core/list"]
const ExerciseItemEditor: React.FC<BlockEditProps<ExerciseItemAttributes>> = (props) => {
  const { attributes } = props
  const [exerciseType, setExerciseType] = useState<undefined | string>(undefined)

  const url = exerciseItemTypes.find((o) => o.identifier === exerciseType)?.url
  const id = attributes.exercise_item_id
  return (
    <ExerciseItemEditorCard id={attributes.exercise_item_id}>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      {!exerciseType && <ChooseExerciseItemType onChooseItem={setExerciseType} />}
      {exerciseType && <IFrameEditor key={id} exerciseItemid={id} url={url} props={props} />}
    </ExerciseItemEditorCard>
  )
}

export default ExerciseItemEditor
