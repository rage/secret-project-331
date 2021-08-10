import { InnerBlocks } from "@wordpress/block-editor"

const UnsupportedSave: React.FC = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default UnsupportedSave
