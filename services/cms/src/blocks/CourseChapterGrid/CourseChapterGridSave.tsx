import { InnerBlocks } from "@wordpress/block-editor"

const CourseGridSave: React.FC<React.PropsWithChildren<unknown>> = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default CourseGridSave
