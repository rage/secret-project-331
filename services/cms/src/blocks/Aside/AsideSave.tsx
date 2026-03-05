"use client"

import { InnerBlocks } from "@wordpress/block-editor"
import { BlockSaveProps } from "@wordpress/blocks"

import { AsideComponentProps } from "."

const AsideSave = (_props: BlockSaveProps<AsideComponentProps>): JSX.Element => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default AsideSave
