import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/table"]

const TABLE_TEMPLATE: Template[] = [["core/table", { placeholder: "TableBox" }]]

const TableEditor: React.FC<React.PropsWithChildren<BlockEditProps<Record<string, unknown>>>> = ({
  clientId,
}) => {
  return (
    <BlockWrapper id={clientId}>
      <div>
        <InnerBlocks
          allowedBlocks={ALLOWED_NESTED_BLOCKS}
          template={TABLE_TEMPLATE}
          // eslint-disable-next-line i18next/no-literal-string
          templateLock="all"
        />
      </div>
    </BlockWrapper>
  )
}

export default TableEditor
