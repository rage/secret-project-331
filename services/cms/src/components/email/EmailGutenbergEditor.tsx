/**
 * WordPress dependencies
 */
// This import is needed for bold, italics, ... formatting
import "@wordpress/format-library"

import "@wordpress/components/build-style/style.css"
import "@wordpress/block-editor/build-style/style.css"
import "@wordpress/block-library/build-style/style.css"
import "@wordpress/block-library/build-style/theme.css"
import "@wordpress/block-library/build-style/editor.css"
import "@wordpress/format-library/build-style/style.css"

import {
  BlockEditorKeyboardShortcuts,
  BlockEditorProvider,
  BlockList,
  WritingFlow,
  ObserveTyping,
} from "@wordpress/block-editor"
import { Popover, SlotFillProvider } from "@wordpress/components"
import { registerCoreBlocks } from "@wordpress/block-library"
import { BlockInstance, getBlockTypes, unregisterBlockType } from "@wordpress/blocks"

/**
 * Internal dependencies
 */
import React, { useEffect } from "react"
import SerializeGutenbergModal from "../SerializeGutenbergModal"
import DebugModal from "../DebugModal"

interface GutenbergEditor {
  content: BlockInstance[]
  onContentChange: React.Dispatch<BlockInstance[]>
}

const allowedEmailBlocks = ["core/paragraph", "core/image", "core/heading", "core/list"]

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
    getBlockTypes().forEach((block) => {
      if (allowedEmailBlocks.indexOf(block.name) === -1) {
        unregisterBlockType(block.name)
      }
    })
  }, [])

  return (
    <div className="editor">
      <SlotFillProvider>
        <BlockEditorProvider value={content} onInput={handleInput} onChange={handleChanges}>
          <div className="editor__content">
            {/* <BlockTools> */}
            <div className="editor-styles-wrapper">
              <Popover.Slot />
              {/* @ts-ignore: type signature incorrect */}
              <BlockEditorKeyboardShortcuts.Register />
              <BlockEditorKeyboardShortcuts />
              <WritingFlow>
                <ObserveTyping>
                  <BlockList />
                </ObserveTyping>
              </WritingFlow>
            </div>
            {/* </BlockTools> */}
          </div>
        </BlockEditorProvider>
      </SlotFillProvider>
      <SerializeGutenbergModal content={content} />
      <DebugModal data={content} />
    </div>
  )
}

export default GutenbergEditor
