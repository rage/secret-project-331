import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { TextField } from "@material-ui/core"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import { useContext } from "react"

import { EditorContentDispatch } from "../../contexts/EditorContentContext"
import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { gutenbergControlsHidden } from "../../styles/EditorStyles"

import { ExerciseAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["moocfi/exercise-slide"]

const ExerciseEditorCard = styled.div`
  padding: 2rem 0;
  margin-top: 3rem;
  margin-bottom: 3rem;
  margin-left: 0;
  margin-right: 0;
  border-top: 1px solid #c0c0c0;
  border-bottom: 1px solid #c0c0c0;
`

const ExerciseEditor: React.FC<BlockEditProps<ExerciseAttributes>> = ({
  attributes,
  clientId,
  setAttributes,
}) => {
  const dispatch = useContext(EditorContentDispatch)

  const handleAddNewSlide = () => {
    dispatch({ type: "addExerciseSlide", payload: { clientId } })
  }

  return (
    <ExerciseEditorCard id={attributes.id}>
      <div className={normalWidthCenteredComponentStyles}>
        <div
          className={css`
            font-size: 18pt;
            font-weight: normal;
            margin-bottom: 1.5rem;
          `}
        >
          Exercise
        </div>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Exercise name"
          value={attributes.name}
          onChange={(e) => setAttributes({ name: e.target.value })}
          className={css`
            margin-bottom: 1rem !important;
          `}
        />
      </div>
      <div className={gutenbergControlsHidden}>
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      </div>
      <div className={normalWidthCenteredComponentStyles}>
        <button onClick={handleAddNewSlide}>Add slide</button>
      </div>
    </ExerciseEditorCard>
  )
}

export default ExerciseEditor
