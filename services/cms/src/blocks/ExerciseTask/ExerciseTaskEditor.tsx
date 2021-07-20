import styled from "@emotion/styled"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"

import ChooseExerciseTaskType from "./ChooseExerciseTaskType"
import { ExerciseTaskTypes, exerciseTaskTypes } from "./ChooseExerciseTaskType/ExerciseServiceList"
import IFrameEditor from "./IFrameEditor"

import { ExerciseTaskAttributes } from "."

const ExerciseTaskEditorCard = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
  margin-bottom: 2rem;
`

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph", "core/list"]
const ExerciseTaskEditor: React.FC<BlockEditProps<ExerciseTaskAttributes>> = (props) => {
  const { attributes, setAttributes } = props
  const handleChooseExerciseTask = (val: ExerciseTaskTypes) => {
    setAttributes({
      exercise_type: val.identifier,
    })
  }
  const exerciseType = attributes?.exercise_type
  const url = exerciseTaskTypes.find((o) => o.identifier === exerciseType)?.url
  const id = attributes.id
  return (
    <ExerciseTaskEditorCard id={attributes.id}>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      {!exerciseType && <ChooseExerciseTaskType onChooseItem={handleChooseExerciseTask} />}
      {exerciseType && <IFrameEditor key={id} exerciseTaskid={id} url={url ?? ""} props={props} />}
    </ExerciseTaskEditorCard>
  )
}

export default ExerciseTaskEditor
