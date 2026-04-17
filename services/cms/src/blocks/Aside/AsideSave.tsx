"use client"

import { InnerBlocks } from "@wordpress/block-editor"
import type { BlockSaveProps } from "@/utils/Gutenberg/types"

import { AsideComponentProps } from "."

const AsideSave = (_props: BlockSaveProps<AsideComponentProps>): JSX.Element => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default AsideSave
