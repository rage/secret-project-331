import { InnerBlocks } from "@wordpress/block-editor"

const ExerciseSave: React.FC<React.PropsWithChildren<unknown>> = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default ExerciseSave
