import { InnerBlocks } from "@wordpress/block-editor"

const CourseProgressSave: React.FC<React.PropsWithChildren<unknown>> = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default CourseProgressSave
