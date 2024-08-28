import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BlockPlaceholderWrapper from "../../BlockPlaceholderWrapper"

import { InnerCardAttributes } from "."

import BackgroundColorCustomizer from "@/components/blocks/BackgroundColorCustomizer"

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph", "core/list", "core/heading"]

const InnerCardEditor: React.FC<React.PropsWithChildren<BlockEditProps<InnerCardAttributes>>> = ({
  clientId,
  setAttributes,
  attributes,
}) => {
  const { t } = useTranslation()

  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("inner-card")}
      explanation={t("inner-card-explanation")}
    >
      <InspectorControls key="inner-card-settings">
        <BackgroundColorCustomizer
          attributes={attributes}
          setAttributes={setAttributes}
          // eslint-disable-next-line i18next/no-literal-string
          defaultBackgroundColor="#faf5f3"
        />
      </InspectorControls>
      <div>
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      </div>
    </BlockPlaceholderWrapper>
  )
}
export default InnerCardEditor
