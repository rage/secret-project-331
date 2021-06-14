/**
 * WordPress dependencies
 */
// This import is needed for bold, italics, ... formatting
import "@wordpress/format-library"

// @wordpress package styles
// @import "~@wordpress/components/src/style.scss";
// @import "~@wordpress/block-editor/src/style.scss";
// @import "~@wordpress/block-library/src/style.scss";
// @import "~@wordpress/block-library/src/theme.scss";
// @import "~@wordpress/block-library/src/editor.scss";
// @import "~@wordpress/format-library/src/style.scss";

import "@wordpress/components/build-style/style.css"
import "@wordpress/block-editor/build-style/style.css"
import "@wordpress/block-library/build-style/style.css"
import "@wordpress/block-library/build-style/theme.css"
import "@wordpress/block-library/build-style/editor.css"
import "@wordpress/format-library/build-style/style.css"
// import "@wordpress/editor/build-style/style.css"
// import "@wordpress/edit-post/build-style/style.css"

import React, { useEffect } from "react"
import {
  BlockEditorKeyboardShortcuts,
  BlockEditorProvider,
  BlockList,
  // BlockToolbar,
  BlockInspector,
  WritingFlow,
  ObserveTyping,
  EditorSettings,
  EditorBlockListSettings,
} from "@wordpress/block-editor"
import { Popover, SlotFillProvider } from "@wordpress/components"
import { registerCoreBlocks } from "@wordpress/block-library"
import { BlockInstance, registerBlockType } from "@wordpress/blocks"

/**
 * Internal dependencies
 */
import SerializeGutenbergModal from "./SerializeGutenbergModal"
import DebugModal from "./DebugModal"
import { blockTypeMap } from "../blocks"
import { addFilter } from "@wordpress/hooks"
import { replaceMediaUpload } from "./OpenMediaGalleryMediaUpload"
import mediaUpload from "../services/backend/mediaUpload"

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
    addFilter("editor.MediaUpload", "moocfi/cms/replace-media-upload", replaceMediaUpload)
    registerCoreBlocks()
    blockTypeMap.forEach(([blockName, block]) => {
      registerBlockType(blockName, block)
    })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorSettings: Partial<EditorSettings & EditorBlockListSettings & { mediaUpload: any }> =
    {}
  // Enables uploading media
  editorSettings.mediaUpload = mediaUpload

  return (
    <div className="editor">
      <SlotFillProvider>
        <BlockEditorProvider
          settings={editorSettings}
          value={content}
          onInput={handleInput}
          onChange={handleChanges}
        >
          <div className="editor__sidebar">
            <BlockInspector />
          </div>
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
