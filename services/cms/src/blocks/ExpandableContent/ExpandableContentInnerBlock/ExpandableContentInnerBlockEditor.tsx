/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
// import { useTranslation } from "react-i18next"

import BlockPlaceholderWrapper from "../../BlockPlaceholderWrapper"

import { ExpandableContentConfigurationProps } from "."

import TextField from "@/shared-module/common/components/InputFields/TextField"

const ALLOWED_NESTED_BLOCKS = [""]
const ExpandableContentInnerBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ExpandableContentConfigurationProps>>
> = ({ clientId, attributes, setAttributes }) => {
  //  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={"Expandable content"}
      explanation={"Expandable content"}
    >
      <TextField
        label="header"
        placeholder="header"
        value={attributes.name}
        onChangeByValue={(value) => setAttributes({ name: value })}
        className={css`
          margin-bottom: 1rem !important;
        `}
      />
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default ExpandableContentInnerBlockEditor
