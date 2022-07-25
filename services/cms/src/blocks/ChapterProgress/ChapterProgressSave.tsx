import { InnerBlocks } from "@wordpress/block-editor"

const ChapterProgressSave: React.FC<React.PropsWithChildren<unknown>> = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default ChapterProgressSave
