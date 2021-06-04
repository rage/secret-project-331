import "@wordpress/block-editor/build-style/style.css"
import "@wordpress/block-library/build-style/style.css"
import "@wordpress/block-library/build-style/theme.css"
import "@wordpress/block-library/build-style/editor.css"
import "@wordpress/components/build-style/style.css"
import "@wordpress/editor/build-style/style.css"
// import "@wordpress/editor/build-style/editor-styles.css"
import "@wordpress/edit-post/build-style/style.css"
import "@wordpress/format-library/build-style/style.css"
import "@wordpress/nux/build-style/style.css"
// This import is needed for bold, italics, ... formatting
import "@wordpress/format-library"

import React, { useEffect } from "react"
import {
  BlockEditorKeyboardShortcuts,
  BlockEditorProvider,
  BlockList,
  BlockInspector,
  WritingFlow,
  ObserveTyping,
} from "@wordpress/block-editor"
import { Popover, SlotFillProvider } from "@wordpress/components"
import { registerCoreBlocks } from "@wordpress/block-library"
import { BlockInstance, registerBlockType } from "@wordpress/blocks"

import SerializeGutenbergModal from "./SerializeGutenbergModal"
import DebugModal from "./DebugModal"
import { css } from "@emotion/css"
import { blockTypeMap } from "../blocks"

interface GutenbergEditor {
  content: BlockInstance[]
  onContentChange: React.Dispatch<BlockInstance[]>
}

const GutenbergEditor: React.FC<GutenbergEditor> = (props: GutenbergEditor) => {
  const { content, onContentChange } = props

  const handleChanges = (page: BlockInstance[]): void => {
    console.log(page)
    onContentChange(page)
  }
  const handleInput = (page: BlockInstance[]): void => {
    console.log(page)
    onContentChange(page)
  }

  useEffect(() => {
    registerCoreBlocks()
    blockTypeMap.forEach(([blockName, block]) => {
      registerBlockType(blockName, block)
    })
  }, [])

  return (
    <div
      className={css`
        /* This makes Gutenberg popovers to keep their position on scrolling */
        position: relative;
      `}
    >
      <SlotFillProvider>
        <BlockEditorProvider value={content} onInput={handleInput} onChange={handleChanges}>
          <div className="playground__sidebar">
            <BlockInspector />
          </div>
          <div className="editor-styles-wrapper">
            {/* @ts-ignore: type signature incorrect */}
            <Popover.Slot name="block-toolbar" />
            {/* @ts-ignore: @type signature incorrect */}
            <BlockEditorKeyboardShortcuts.Register />
            <BlockEditorKeyboardShortcuts />
            <WritingFlow>
              <ObserveTyping>
                <BlockList />
              </ObserveTyping>
            </WritingFlow>
          </div>
          <Popover.Slot />
        </BlockEditorProvider>
      </SlotFillProvider>
      <SerializeGutenbergModal content={content} />
      <DebugModal data={content} />
    </div>
  )
}

export default GutenbergEditor
