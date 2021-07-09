import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { TextField } from "@material-ui/core"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"

import { ExerciseAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["moocfi/exercise-task"]

const ExerciseEditorCard = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
  margin-top: 3rem;
  margin-bottom: 3rem;
`

const ExerciseEditor: React.FC<BlockEditProps<ExerciseAttributes>> = ({
  attributes,
  setAttributes,
}) => {
  return (
    <ExerciseEditorCard id={attributes.id}>
      <div>Exercise editor</div>
      <TextField
        fullWidth
        variant="outlined"
        value={attributes.name}
        onChange={(e) => setAttributes({ name: e.target.value })}
        className={css`
          margin-bottom: 1rem !important;
        `}
      />
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </ExerciseEditorCard>
  )
}

export default ExerciseEditor
