"use client"

import { InnerBlocks } from "@wordpress/block-editor"

import type { AsideComponentProps } from "."

import type { BlockSaveProps } from "@/utils/Gutenberg/types"

const AsideSave = (_props: BlockSaveProps<AsideComponentProps>): JSX.Element => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default AsideSave
