import { InnerBlocks } from "@wordpress/block-editor"

const AsideWithImageSave: React.FC<unknown> = () => {
  return (
    <aside>
      <InnerBlocks.Content />
    </aside>
  )
}

export default AsideWithImageSave
