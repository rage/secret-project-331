import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/columns"]

const LOGO_LINK_TEMPLATE: Template[] = [
  [
    "core/columns",
    { isStackedOnMobile: true },
    [
      ["core/column", {}, [["core/image"]]],
      ["core/column", {}, [["core/image"]]],
      ["core/column", {}, [["core/image"]]],
    ],
  ],
]

const LogoLinkEditor: React.FC<React.PropsWithChildren<BlockEditProps<Record<string, never>>>> = ({
  clientId,
}) => {
  return (
    <BlockWrapper id={clientId}>
      <div
        className={css`
          background: #fafbfb;
          width: 100%;
        `}
      >
        <div>
          <InnerBlocks
            template={LOGO_LINK_TEMPLATE}
            allowedBlocks={ALLOWED_NESTED_BLOCKS}
            templateLock="all"
          />
        </div>
      </div>
    </BlockWrapper>
  )
}

export default LogoLinkEditor
