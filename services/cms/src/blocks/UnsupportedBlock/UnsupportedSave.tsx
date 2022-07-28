import { InnerBlocks } from "@wordpress/block-editor"

const UnsupportedSave: React.FC<unknown> = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default UnsupportedSave
