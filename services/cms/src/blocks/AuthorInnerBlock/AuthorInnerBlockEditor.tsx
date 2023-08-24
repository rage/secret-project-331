import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BlockWrapper from "../BlockWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph"]
const AUTHOR_BLOCK_TEMPLATE: Template[] = [
  [
    "core/columns",
    { isStackedOnMobile: true },
    [
      [
        "core/column",
        {},
        [
          [
            "core/image",
            {
              level: 2,
              textAlign: "left",
              anchor: "author-photo",
            },
          ],
        ],
      ],
      [
        "core/column",
        {},
        [
          [
            "core/paragraph",
            {
              content: "Insert author's bio text...",
              placeholder: "Insert author's bio text...",
              align: "center",
            },
          ],
        ],
      ],
    ],
  ],
]

const AuthorEditor: React.FC<React.PropsWithChildren<BlockEditProps<Record<string, never>>>> = ({
  clientId,
}) => {
  const { t } = useTranslation()
  return (
    <BlockWrapper id={clientId}>
      <div>
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} template={AUTHOR_BLOCK_TEMPLATE} />
      </div>
    </BlockWrapper>
  )
}

export default AuthorEditor
