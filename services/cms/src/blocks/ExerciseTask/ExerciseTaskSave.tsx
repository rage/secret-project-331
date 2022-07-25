import { InnerBlocks } from "@wordpress/block-editor"

const ExerciseTaskSave: React.FC<React.PropsWithChildren<unknown>> = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default ExerciseTaskSave
