import { InnerBlocks } from "@wordpress/block-editor"

const InfoBoxSave: React.FC<React.PropsWithChildren<unknown>> = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default InfoBoxSave
