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
  BlockInspector,
  BlockList,
  // BlockToolbar,
  EditorBlockListSettings,
  EditorSettings,
  ObserveTyping,
  WritingFlow,
} from "@wordpress/block-editor"
import { registerCoreBlocks } from "@wordpress/block-library"
import {
  BlockConfiguration,
  BlockInstance,
  getBlockType,
  getBlockTypes,
  registerBlockType,
  unregisterBlockType,
  /* @ts-ignore: type signature incorrect */
  unregisterBlockVariation,
} from "@wordpress/blocks"
import { Popover, SlotFillProvider } from "@wordpress/components"
import { addFilter } from "@wordpress/hooks"
import React, { useContext, useEffect } from "react"

import CourseContext from "../../contexts/CourseContext"
import mediaUploadBuilder, { MediaUploadProps } from "../../services/backend/media/mediaUpload"
import { modifyBlockAttributes } from "../../utils/Gutenberg/modifyBlockAttributes"

interface GutenbergEditorProps {
  content: BlockInstance[]
  onContentChange: React.Dispatch<BlockInstance[]>
  allowedBlocks?: string[]
  allowedBlockVariations?: Record<string, string[]>
  customBlocks?: [string, BlockConfiguration<unknown>][]
}

const GutenbergEditor: React.FC<GutenbergEditorProps> = ({
  content,
  onContentChange,
  allowedBlockVariations,
  allowedBlocks,
  customBlocks,
}: GutenbergEditorProps) => {
  const courseId = useContext(CourseContext).courseInstanceId
  const handleChanges = (newContent: BlockInstance[]): void => {
    console.log(newContent)
    onContentChange(newContent)
  }
  const handleInput = (newContent: BlockInstance[]): void => {
    console.log(newContent)
    onContentChange(newContent)
  }

  // Media upload gallery not yet supported, uncommenting this will add a button besides the "Upload" button.
  // addFilter("editor.MediaUpload", "moocfi/cms/replace-media-upload", mediaUploadGallery)
  addFilter("blocks.registerBlockType", "moocfi/cms/modify-blockAttributes", modifyBlockAttributes)

  useEffect(() => {
    // Register all core blocks
    registerCoreBlocks()

    // Unregister unwanted blocks
    if (allowedBlocks) {
      getBlockTypes().forEach((block) => {
        if (allowedBlocks.indexOf(block.name) === -1) {
          unregisterBlockType(block.name)
        }
      })
    }

    // Unregister unwanted block variations
    if (allowedBlockVariations) {
      for (const [blockName, allowedVariations] of Object.entries(allowedBlockVariations)) {
        /* @ts-ignore: type signature incorrect */
        getBlockType(blockName).variations.forEach((variation) => {
          if (allowedVariations.indexOf(variation.name) === -1) {
            unregisterBlockVariation(blockName, variation.name)
          }
        })
      }
    }

    // Register own blocks
    if (customBlocks) {
      customBlocks.forEach(([blockName, block]) => {
        registerBlockType(blockName, block)
      })
    }
  }, [allowedBlockVariations, allowedBlocks, customBlocks])

  const editorSettings: Partial<
    EditorSettings & EditorBlockListSettings & { mediaUpload: (props: MediaUploadProps) => void }
  > = {}
  // Enables uploading media
  editorSettings.mediaUpload = mediaUploadBuilder(courseId)

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
