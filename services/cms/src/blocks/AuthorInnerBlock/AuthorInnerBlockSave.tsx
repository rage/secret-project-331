import { InnerBlocks } from "@wordpress/block-editor"

const AuthorInnerBlockSave: React.FC<unknown> = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default AuthorInnerBlockSave
