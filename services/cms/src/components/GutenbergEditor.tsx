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
import { addFilter } from "@wordpress/hooks"

/**
 * Internal dependencies
 */
import React, { useEffect } from "react"
import SerializeGutenbergModal from "./SerializeGutenbergModal"
import DebugModal from "./DebugModal"
import { blockTypeMap } from "../blocks"
import { mediaUploadGallery } from "./media/OpenMediaGalleryMediaUpload"
import mediaUploadBuilder, { MediaUploadProps } from "../services/backend/media/mediaUpload"
import useQueryParameter from "../hooks/useQueryParameter"

interface GutenbergEditor {
  content: BlockInstance[]
  onContentChange: React.Dispatch<BlockInstance[]>
}

const GutenbergEditor: React.FC<GutenbergEditor> = (props: GutenbergEditor) => {
  const pageId = useQueryParameter("id")
  const { content, onContentChange } = props

  const handleChanges = (page: BlockInstance[]): void => {
    onContentChange(page)
  }
  const handleInput = (page: BlockInstance[]): void => {
    onContentChange(page)
  }

  useEffect(() => {
    addFilter("editor.MediaUpload", "moocfi/cms/replace-media-upload", mediaUploadGallery)
    registerCoreBlocks()
    blockTypeMap.forEach(([blockName, block]) => {
      registerBlockType(blockName, block)
    })
  }, [])

  const editorSettings: Partial<
    EditorSettings & EditorBlockListSettings & { mediaUpload: (props: MediaUploadProps) => void }
  > = {}
  // Enables uploading media
  editorSettings.mediaUpload = mediaUploadBuilder(pageId)

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
