import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import { defaultContainerWidth } from "../../shared-module/styles/constants"

import ChooseExerciseTaskType from "./ChooseExerciseTaskType"
import { exerciseTaskTypes } from "./ChooseExerciseTaskType/ExerciseServiceList"
import ExerciseTaskIFrameEditor from "./IFrameEditor"

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph", "core/list"]

const ExerciseTaskEditorCard = styled.div`
  padding: 2rem 0;
  margin-bottom: 2rem;
`

export interface ExerciseTaskAttributes {
  id: string
  exercise_type: string
  private_spec: unknown
}

const ExerciseTaskEditor: React.FC<BlockEditProps<ExerciseTaskAttributes>> = ({
  attributes,
  setAttributes,
}) => {
  const exerciseType = attributes.exercise_type
  const url = exerciseTaskTypes.find((o) => o.identifier === exerciseType)?.url

  return (
    <ExerciseTaskEditorCard id={attributes.id}>
      <div
        className={css`
          font-size: 18pt;
          font-weight: normal;
          margin-bottom: 1.5rem;
        `}
      >
        Task
      </div>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      {!exerciseType ? (
        <ChooseExerciseTaskType
          onChooseItem={(x) => setAttributes({ exercise_type: x.identifier })}
        />
      ) : (
        <ExerciseTaskIFrameEditor
          onPrivateSpecChange={(x) => setAttributes({ private_spec: x })}
          privateSpec={attributes.private_spec}
          url={`${url}?width=${defaultContainerWidth}`}
        />
      )}
    </ExerciseTaskEditorCard>
  )
}

export default ExerciseTaskEditor
