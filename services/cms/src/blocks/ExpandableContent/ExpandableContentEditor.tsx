/* eslint-disable i18next/no-literal-string */
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
// import { useTranslation } from "react-i18next"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/expandable-content-inner-block"]
const ExpandableContentEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = ({ clientId }) => {
  //  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={"Expandable content"}
      explanation={"Expandable content"}
    >
      <div>
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      </div>
    </BlockPlaceholderWrapper>
  )
}

export default ExpandableContentEditor
