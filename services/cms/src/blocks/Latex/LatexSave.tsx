import { InnerBlocks } from "@wordpress/block-editor"

const LatexSave: React.FC<React.PropsWithChildren<unknown>> = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default LatexSave
