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
import { addFilter } from "@wordpress/hooks"
import {
  BlockInstance,
  getBlockType,
  getBlockTypes,
  registerBlockType,
  unregisterBlockType,
  /* @ts-ignore: type signature incorrect */
  unregisterBlockVariation,
} from "@wordpress/blocks"

/**
 * Internal dependencies
 */
import React, { useEffect } from "react"
import { blockTypeMap } from "../blocks"
import mediaUploadBuilder, { MediaUploadProps } from "../services/backend/media/mediaUpload"
import useQueryParameter from "../hooks/useQueryParameter"
import { modifyBlockAttributes } from "../utils/Gutenberg/modifyBlockAttributes"
import { supportedCoreBlocks, allowedEmbedBlocks } from "../blocks/supportedGutenbergBlocks"

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

  // Media upload gallery not yet supported, uncommenting this will add a button besides the "Upload" button.
  // addFilter("editor.MediaUpload", "moocfi/cms/replace-media-upload", mediaUploadGallery)
  addFilter("blocks.registerBlockType", "moocfi/cms/modify-blockAttributes", modifyBlockAttributes)

  useEffect(() => {
    // Register all core blocks
    registerCoreBlocks()
    // Register own blocks
    // Unregister unwanted blocks
    getBlockTypes().forEach((block) => {
      if (supportedCoreBlocks.indexOf(block.name) === -1) {
        unregisterBlockType(block.name)
      }
    })
    /* @ts-ignore: type signature incorrect */
    getBlockType("core/embed").variations.forEach((variation) => {
      if (allowedEmbedBlocks.indexOf(variation.name) === -1) {
        unregisterBlockVariation("core/embed", variation.name)
      }
    })

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
    </div>
  )
}

export default GutenbergEditor
