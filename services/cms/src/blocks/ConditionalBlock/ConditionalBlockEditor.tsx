import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import CheckBox from "../../shared-module/components/InputFields/CheckBox"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { ConditionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/buttons", "core/button", "core/paragraph"]

const ConditionalBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ConditionAttributes>>
> = ({ attributes, clientId, setAttributes }) => {
  return (
    <BlockPlaceholderWrapper id={clientId}>
      <h3>{`Conditional Block`}</h3>
      <p>{`Mark the condition for rendering the block`}</p>
      <CheckBox
        label={`course module completion`}
        checked={attributes.module_completion}
        onChangeByValue={function (checked: boolean): void {
          setAttributes({ module_completion: checked })
        }}
      />
      <CheckBox
        label={`course instance enrollment`}
        checked={attributes.instance_enrollment}
        defaultValue={""}
        onChangeByValue={function (checked: boolean): void {
          setAttributes({ instance_enrollment: checked })
        }}
      />
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default ConditionalBlockEditor
