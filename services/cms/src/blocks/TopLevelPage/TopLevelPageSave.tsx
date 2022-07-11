import { InnerBlocks } from "@wordpress/block-editor"

const TopLevelPageSave: React.FC = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default TopLevelPageSave
