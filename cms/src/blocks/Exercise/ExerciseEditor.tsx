import styled from "@emotion/styled"
import { TextField } from "@material-ui/core"
import { BlockEditProps } from "@wordpress/blocks"
import { ExerciseAttributes } from "."
import { InnerBlocks } from "@wordpress/block-editor"

const ALLOWED_NESTED_BLOCKS = ["moocfi/exercise-item"]

const ExerciseEditorCard = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
`

const Title = styled.h1`
  font-size: 24px;
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
      />
      <Title>{attributes.name}</Title>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </ExerciseEditorCard>
  )
}

export default ExerciseEditor
