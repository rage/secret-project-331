import { useState } from "react"
import styled from "@emotion/styled"
import ChooseExerciseItemType from "./ChooseExerciseItemType"
import IFrameEditor from "./IFrameEditor"
import { BlockEditProps } from "@wordpress/blocks"
import { ExerciseItemAttributes } from "."
import { ExerciseItemTypes, exerciseItemTypes } from "./ChooseExerciseItemType/ExerciseServiceList"
import { InnerBlocks } from "@wordpress/block-editor"

const ExerciseItemEditorCard = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
`

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph", "core/list"]
const ExerciseItemEditor: React.FC<BlockEditProps<ExerciseItemAttributes>> = (props) => {
  const { attributes, setAttributes } = props
  const handleChooseExerciseItem = (val: ExerciseItemTypes) => {
    setAttributes(
    {
      exercise_type: val.identifier
    });
  }
  const exerciseType = attributes?.exercise_type
  const url = exerciseItemTypes.find((o) => o.identifier === exerciseType)?.url
  const id = attributes.id
  return (
    <ExerciseItemEditorCard id={attributes.id}>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      {!exerciseType && <ChooseExerciseItemType onChooseItem={handleChooseExerciseItem} />}
      {exerciseType && <IFrameEditor key={id} exerciseItemid={id} url={url} props={props} />}
    </ExerciseItemEditorCard>
  )
}

export default ExerciseItemEditor
