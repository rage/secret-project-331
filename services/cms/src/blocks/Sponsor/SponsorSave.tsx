import { InnerBlocks } from "@wordpress/block-editor"

const SponsorSave: React.FC<React.PropsWithChildren<unknown>> = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default SponsorSave
