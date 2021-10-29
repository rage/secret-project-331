import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import { EditorContentDispatch } from "../../contexts/EditorContentContext"
import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { defaultContainerWidth } from "../../shared-module/styles/constants"
import { gutenbergControlsVisible } from "../../styles/EditorStyles"

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
  show_editor: boolean
}

const ExerciseTaskEditor: React.FC<BlockEditProps<ExerciseTaskAttributes>> = ({
  attributes,
  clientId,
  setAttributes,
}) => {
  const dispatch = useContext(EditorContentDispatch)

  const { t } = useTranslation()

  const handleDeleteTask = () => {
    dispatch({ type: "deleteExerciseTask", payload: { clientId } })
  }

  const exerciseType = attributes.exercise_type
  const url = exerciseTaskTypes.find((o) => o.identifier === exerciseType)?.url

  return (
    <div>
      <div className={normalWidthCenteredComponentStyles}>
        <div
          className={css`
            display: flex;
            flex-direction: row;
          `}
        >
          <div
            className={css`
              flex: 6;
            `}
          >
            {t("task")}
          </div>
          <div
            className={css`
              flex: 1;
            `}
          >
            <button onClick={() => setAttributes({ show_editor: !attributes.show_editor })}>
              {attributes.show_editor ? t("close") : t("edit")}
            </button>
          </div>
          <div
            className={css`
              flex: 1;
            `}
          >
            <button onClick={handleDeleteTask}>{t("delete")}</button>
          </div>
        </div>
      </div>
      {attributes.show_editor ? (
        <ExerciseTaskEditorCard id={attributes.id}>
          <div className={gutenbergControlsVisible}>
            <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
          </div>
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
      ) : null}
    </div>
  )
}

export default ExerciseTaskEditor
